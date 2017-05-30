/*-----------------------------------------------------------------------------
This project is a Cortana skill for practicing for the US Naturalization exam. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
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
            .buttons([
                builder.CardAction.imBack(session, 'roll again', 'Roll Again'), // TODO replace buttons
                builder.CardAction.imBack(session, 'new game', 'New Game')
            ]);
        if (multiLine) {
            //card.title('card_title').text('\n\n' + results + '\n\n');
            card.text(results);
        } else {
            card.title(results);
        }
        var msg = new builder.Message(session).addAttachment(card);



        // Build up spoken response
        var spoken = 'Let\'s take the quiz';
        msg.speak(ssml.speak(spoken));
        msg.text = spoken;

        
        test.turns++;
        test.current_question_index = 0;
        session.conversationData.test = test;

        /**
         * Send card and bots reaction to user. 
         */
        msg.inputHint(builder.InputHint.acceptingInput);
        session.send(msg); //.endDialog();

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
}).triggerAction({ matches: /start over| restart/i });

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
        //session.send('Ok, sounds like your answer was: %s', results.response);

        var lastUtterance = results.response;
        session.send('Ok, sounds like your answer was: %s', lastUtterance);
        session.send('The official answer is: %s', session.conversationData.questions[session.conversationData.test.current_question_index].answer);
        session.conversationData.test.current_question_index++; // increment count if we got a recognized result.
        // Ask another question 
        session.replaceDialog('AskQuestionDialog');
    }
]);


/** *******************************************************************************
 * 
 * This dialog sets up a custom game for the bot to play.  It will 
 * ask the user how many sides they want the dice to have and then
 * how many should be rolled. Once it's built up the game structure
 * it will pass it to a separate 'PlayGameDialog'.
 */
bot.dialog('CreateGameDialog', [
    function (session) {
        // Initialize game structure.
        // - dialogData gives us temporary storage of this data in between
        //   turns with the user.
        var game = session.dialogData.game = { 
            type: 'custom', 
            sides: null, 
            count: null,
            turns: 0
        };

        /**
         * Ask for the number of sides.
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
            { value: '4', action: { title: '4 Sides' }, synonyms: 'four|for|4 sided|4 sides' },
            { value: '6', action: { title: '6 Sides' }, synonyms: 'six|sex|6 sided|6 sides' },
            { value: '8', action: { title: '8 Sides' }, synonyms: 'eight|8 sided|8 sides' },
            { value: '10', action: { title: '10 Sides' }, synonyms: 'ten|10 sided|10 sides' },
            { value: '12', action: { title: '12 Sides' }, synonyms: 'twelve|12 sided|12 sides' },
            { value: '20', action: { title: '20 Sides' }, synonyms: 'twenty|20 sided|20 sides' },
        ];
        builder.Prompts.choice(session, 'choose_sides', choices, { 
            speak: speak(session, 'choose_sides_ssml') 
        });
    },
    function (session, results) {
        // Store users input
        // - The response comes back as a find result with index & entity value matched.
        var game = session.dialogData.game;
        game.sides = Number(results.response.entity);

        /**
         * Ask for number of dice.
         * 
         * - We can use gettext() to format a string using a template stored in our
         *   localized prompts file.
         * - The number prompt lets us pass additional options to say we only want
         *   integers back and what's the min & max value that's allowed.
         */
        var prompt = session.gettext('choose_count', game.sides);
        builder.Prompts.number(session, prompt, {
            speak: speak(session, 'choose_count_ssml'),
            minValue: 1,
            maxValue: 100,
            integerOnly: true
        });
    },
    function (session, results) {
        // Store users input
        // - The response is already a number.
        var game = session.dialogData.game;
        game.count = results.response;

        /**
         * Play the game we just created.
         * 
         * We can use replaceDialog() to end the current dialog and start a new
         * one in its place. We can pass arguments to dialogs so we'll pass the
         * 'PlayGameDialog' the game we created.
         */
        session.replaceDialog('PlayGameDialog', { game: game });
    }
]).triggerAction({ matches: [
    /(roll|role|throw|shoot).*(dice|die|dye|bones)/i,
    /new game/i
 ]});

/**
 * This dialog is our main game loop. We'll store the game structure in
 * session.conversationData so that should the user say "roll again" we
 * can just re-roll the same set of dice again.
 */
bot.dialog('PlayGameDialog', function (session, args) {
    // Get current or new game structure.
    var game = args.game || session.conversationData.game;
    if (game) {
        // Generate rolls
        var total = 0;
        var rolls = [];
        for (var i = 0; i < game.count; i++) {
            var roll = Math.floor(Math.random() * game.sides) + 1;
            if (roll > game.sides) {
                // Accounts for 1 in a million chance random() generated a 1.0
                roll = game.sides;
            }
            total += roll;
            rolls.push(roll);
        }

        // Format roll results
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
            .subtitle(game.count > 1 ? 'card_subtitle_plural' : 'card_subtitle_singular', game)
            .buttons([
                builder.CardAction.imBack(session, 'roll again', 'Roll Again'),
                builder.CardAction.imBack(session, 'new game', 'New Game')
            ]);
        if (multiLine) {
            //card.title('card_title').text('\n\n' + results + '\n\n');
            card.text(results);
        } else {
            card.title(results);
        }
        var msg = new builder.Message(session).addAttachment(card);

        // Determine bots reaction for speech purposes
        var reaction = 'normal';
        var min = game.count;
        var max = game.count * game.sides;
        var score = total/max;
        if (score == 1.0) {
            reaction = 'best';
        } else if (score == 0) {
            reaction = 'worst';
        } else if (score <= 0.3) {
            reaction = 'bad';
        } else if (score >= 0.8) {
            reaction = 'good';
        }
        
        // Check for special craps rolls
        if (game.type == 'craps') {
            switch (total) {
                case 2:
                case 3:
                case 12:
                    reaction = 'craps_lose';
                    break;
                case 7:
                    reaction = 'craps_seven';
                    break;
                case 11:
                    reaction = 'craps_eleven';
                    break;
                default:
                    reaction = 'craps_retry';
                    break;
            }
        }

        // Build up spoken response
        var spoken = '';
        if (game.turn == 0) {
            spoken += session.gettext('start_' + game.type + '_game_ssml') + ' ';
        } 
        spoken += session.gettext(reaction + '_roll_reaction_ssml');
        msg.speak(ssml.speak(spoken));

        // Incrment number of turns and store game to roll again
        game.turn++;
        session.conversationData.game = game;

        /**
         * Send card and bots reaction to user. 
         */
        msg.inputHint(builder.InputHint.acceptingInput);
        session.send(msg).endDialog();
    } else {
        // User started session with "roll again" so let's just send them to
        // the 'CreateGameDialog'
        session.replaceDialog('CreateGameDialog');
    }
}).triggerAction({ matches: /(roll|role|throw|shoot) again/i });

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
            builder.CardAction.imBack(session, 'roll some dice', 'Roll Dice'),
            builder.CardAction.imBack(session, 'play craps', 'Play Craps')
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