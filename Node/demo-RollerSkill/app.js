/*-----------------------------------------------------------------------------
This project is a Cortana skill for practicing for the US Naturalization exam. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var sprintf = require("sprintf-js").sprintf;
var util = require('util');
var ssml = require('./ssml');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/**
 * Create your bot with a function to receive messages from the user.
 * - This function will be called anytime the users utterance isn't
 *   recognized.
 */
var bot = new builder.UniversalBot(connector, function (session) {
    // set up global data
    session.conversationData.questions = [
        {question: 'What is the capital of the United States?', answer: 'Washington, D.C.'},
        {question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island'},
        {question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states'},
        {question: 'When do we celebrate Independence Day?', answer: 'July 4'},
        {question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans'}
        ];
    // Just redirect to our 'HelpDialog'.
    session.replaceDialog('HelpDialog');
});

/**
 * This dialog sets up a test for the bot to administer.  It will 
 * ask the user for the difficulty level. The difficulty level can include:
 *   -- Whether or not text is displayed in English and/or their native language (only supporting Chinese now)
 *   -- Speed at which prompts are read to the user.
 * Once it's built up the test structure
 * it will pass it to a separate 'TakeTestDialog'.
 * 
 * We've added a triggerAction() to this dialog that lets a user say
 * something like "I'd like to take a test" to start the dialog.
 * We're using a RegEx to match the users input but we could just as 
 * easily use a LUIS intent.
 */
bot.dialog('CreateTestDialog', [
    function (session) {
        // Initialize game structure.
        // - dialogData gives us temporary storage of this data in between
        //   turns with the user.
        var test = session.dialogData.test = { 
            type: 'custom', 
            level: null, 
            count: null,
            questions_picked: {}, 
            current_question_index: 0,
            turns: 0
        };

        /**
         * Ask for the difficult level.
         * 
         * You can pass an array of choices to be matched. These will be shown as a
         * numbered list by default.  This list will be shown as a numbered list which
         * is what we want since we have so many options.
         * 
         * - value is what you want returned via 'results.response.entity' when selected.
         * - action lets you customize the displayed label and for buttons what get sent when clicked.
         * - synonyms let you specify alternate things to recognize for a choice.
         */
        var choices = [
            { value: 'easy', action: { title: 'Easy' }, synonyms: 'easy|easy ones|easy questions' },
            { value: 'hard', action: { title: 'Hard' }, synonyms: 'hard|hard ones|hard questions' },
            { value: 'both', action: { title: 'Both' }, synonyms: 'both|both kinds|combination' },
        ];
        builder.Prompts.choice(session, 'choose_level', choices, { 
            speak: speak(session, 'choose_level_ssml') 
        });
    },
    function (session, results) {
        // Store users input
        // - The response comes back as a find result with index & entity value matched.
        var test = session.dialogData.test;
        test.level = results.response.entity;  // Question - does this entity have to do with my LUIS model?

        /**
         * Ask for number of questions to ask.
         * 
         * - We can use gettext() to format a string using a template stored in our
         *   localized prompts file.
         * - The number prompt lets us pass additional options to say we only want
         *   integers back and what's the min & max value that's allowed.
         */
        var prompt = session.gettext('choose_count_questions', test.level);
        builder.Prompts.number(session, prompt, {
            speak: speak(session, 'choose_count_ssml'),
            minValue: 1,
            maxValue: 10,
            integerOnly: true
        });
    },
    function (session, results) {
        // Store users input
        // - The response is already a number.
        var test = session.dialogData.test;
        test.count = results.response;

        /**
         * Play the game we just created.
         * 
         * We can use replaceDialog() to end the current dialog and start a new
         * one in its place. We can pass arguments to dialogs so we'll pass the
         * 'TakeTestDialog' the test we created.
         */
        session.replaceDialog('TakeTestDialog', { test: test });
    }
]).triggerAction({ matches: [
    /.*(text|test|exam|interview|quiz|practice)/i,
    /new test/i
 ]});

/**
 * This dialog is our main test loop. We'll store the game structure in
 * session.conversationData so that should the user say "start over" we
 * can just restart the same test.
 */
bot.dialog('TakeTestDialog', function (session, args) {
    // Get current or new test structure.
    var test = args.test || session.conversationData.test;
    if (test) {
        // Generate array of indices into the question list
        // The first few questions with index < last_easy are the easy ones.
        var num_easy_questions = 3; // TODO: define in game constants
        // The hard questions will be contiguous
        var first_hard_question = 5;
        var num_hard_questions = 3;
        var total = 0;
        var rolls = [];
        for (var i = 0; i < test.count; i++) {
            var roll;
            if (test.level == 'easy') {
                roll = Math.floor(Math.random() * num_easy_questions);  //TODO: don't add repeat questions
            }
            if (test.level == 'hard') {
                roll = first_hard_question + Math.floor(Math.random() * num_hard_questions);
            }
            rolls.push(roll);
        }

        // set the conversation-level list of chosen question to ask
        // This can also be passed to the next dialog as a parameter.
        test.questions_picked = rolls; 
        session.conversationData.test = test;

        // Format question list used for debugging
        var results = '';
        var multiLine = rolls.length > 5;
        for (var i = 0; i < rolls.length; i++) {
            if (i > 0) {
                results += ' . ';
            }
            results += rolls[i];
        }

        // Render results using a card
        var card = new builder.HeroCard(session)
            .subtitle(test.count > 1 ? 'card_subtitle_plural_questions' : 'card_subtitle_singular_questions')
            .buttons([ // these should be for starting the test
                builder.CardAction.imBack(session, 'repeat', 'Repeat Previous'), // TODO replace buttons
                builder.CardAction.imBack(session, 'new test', 'New Test')
            ]);
        if (multiLine) {
            //card.title('card_title').text('\n\n' + results + '\n\n');
            
            card.text(results);
        } else {
            card.title('Let\'s take a quiz!');
            card.text(sprintf('Let\'s take a quiz! The questions selected for you are: %s', results));
        }
        var msg = new builder.Message(session).addAttachment(card);



        // Build up spoken response
        announceQuiz = 0;
        if (announceQuiz) {
            var spoken = 'Let\'s take the quiz';
            msg.speak(ssml.speak(spoken));
            msg.text = spoken;

            msg.inputHint(builder.InputHint.ignoringInput);
        }
         /**
         * Send card and bots reaction to user. 
         */
            session.send(msg); //.endDialog();
        

        test.turns++;
        test.current_question_index = 0;
        session.conversationData.test = test;



        //setTimeout(function () {
            //session.send("Hello there...");

        //}, 3000);

        // for 1 to count questions go to AskQuestionDialog ask test.questions_picked
        //for (curr_q = 0; curr_q < test.count; curr_q++) {
        //    session.conversationData.current_question_index = session.conversationData.test.questions_picked[curr_q];
            session.beginDialog('AskQuestionDialog'); // replaceDialog('PlayGameDialog', { game: game });
        //}
    } else {
        // User started session with "start over" so let's just send them to
        // the 'CreateTestDialog'
        session.replaceDialog('CreateTestDialog');
    }
}).triggerAction({ matches: /start over| restart | repeat /i });

bot.dialog('AskQuestionDialog', [
    function (session, args) {
        // get our current index into the question list.
        var current_question_index = session.conversationData.test.current_question_index;
        if (current_question_index < session.conversationData.test.count) { 
            var question = session.conversationData.questions[current_question_index].question;  // TODO: handle undefined question
            console.log('*******\nQuestion #%d is %s. \n*****\n', current_question_index, question); 
            // ask the question
            builder.Prompts.text(session, question);
        } else {
            // we don't know where we are in the test, or we're done (ind==count). 
            // So start over?
            console.log('Index is %d, about to ask for help', current_question_index); 
            session.replaceDialog('HelpDialog', {test: session.conversationData.test, msg: 'Do you want another test?'});
        }
        // BUG - When the else was triggering above, the prompt would fail here, so moved it to inside the if.
    },
    function (session, results) {

        var lastUtterance = results.response;
        // session.send('Ok, sounds like your answer was: %s', lastUtterance);
        var textToEcho = sprintf("Ok, sounds like your answer was: %s", lastUtterance);
        session.say(textToEcho, 'good answer', { inputHint: builder.InputHint.ignoringInput });  // TODO: rate answer based on intent score
        // TODO: put textToEcho in the card to display.
        var officialAnswer = session.conversationData.questions[session.conversationData.test.current_question_index].answer;
        var txtOfficialAnswer = sprintf('The official answer is: %s', officialAnswer);
        session.say(txtOfficialAnswer, txtOfficialAnswer, { inputHint: builder.InputHint.ignoringInput } ); // TODO: put textToEcho in the card to display - So, putting many fields in one card.
        session.conversationData.test.current_question_index++; // increment count if we got a recognized result.
        // Ask another question 
        session.replaceDialog('AskQuestionDialog');
    }
]);



/**
 * Listen for the user to ask to play craps.
 * 
 * While you can use a triggerAction() to start a dialog, you sometimes just want
 * to either send a message when a user says something or start an existing dialog
 * with some arguments. You can use a cusomAction() to recognize something the user
 * says without tampering with the dialog stack. In our case what we want to do is
 * call 'PlayGameDialog' with a pre-defined game structure. 
 */
bot.customAction({
    matches: /(play|start).*(craps)/i,
    onSelectAction: function (session, args, next) {
        // The user could be in another dialog so clear the dialog stack first
        // to make sure we end that task.
        session.clearDialogStack().beginDialog('PlayGameDialog', {
            game: { type: 'craps', sides: 6, count: 2, turn: 0 }
        })
    }
});

/**
 * Every bot should have a help dialog. Ours will use a card with some buttons
 * to educate the user with the options available to them.
 * 
 * Help should: allow the user to decide to change settings like speed and 
 * tooltip display.
 */
bot.dialog('HelpDialog', function (session) {
    
    var card = new builder.HeroCard(session)
        .title('help_title')
        .buttons([
            builder.CardAction.imBack(session, 'take test', 'New Test'),
            builder.CardAction.imBack(session, 'repeat', 'Repeat Previous Test')
        ]);
    var msg = new builder.Message(session)
        .speak(speak(session, 'help_ssml'))
        .addAttachment(card)
        .inputHint(builder.InputHint.acceptingInput);
    session.send(msg).endDialog();
}).triggerAction({ matches: /help/i });

/** Helper function to wrap SSML stored in the prompts file with <speak/> tag. */
function speak(session, prompt) {
    // var localized = session.gettext(prompt);
    loc = session.preferredLocale();
    var localized = session.localizer.gettext(loc, prompt);
    return ssml.speak(localized);
}