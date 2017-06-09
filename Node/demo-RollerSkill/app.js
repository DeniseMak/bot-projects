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

    // TODO: Move this to Help, to set once - in case it won't be persisted before call to set.
    session.conversationData.questions = [
        {question: 'What is the capital of the United States?', answer: 'Washington, D.C.'},
        {question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island'},
        {question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states'},
        {question: 'When do we celebrate Independence Day?', answer: 'July 4'},
        {question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans'},
        {question: 'What is one right or freedom from the First Amendment?', answer: 'Secretary of State, Secretary of Labor'},
        {question: 'What are two cabinet-level positions', answer: 'Secretary of State, Secretary of Labor'}
        ];
    session.conversationData.turns = 0;
    // Just redirect to our 'HelpDialog'.
    session.replaceDialog('HelpDialog');
});

// Enable Conversation Data persistence
bot.set('persistConversationData', true);

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
        var test = session.conversationData.test = { 
            type: 'custom', 
            level: null, 
            count: null, // number of question the user wants to do.
            questions_picked: {}, 
            current_question_index: 0,
            turns: 0,
            num_questions: 0,
            score: 0
        };
        session.dialogData.test = test;

        session.conversationData.questions = [
            // Questions for those over 65 who have lived in the states for over 20 years.
            { question: 'What is the capital of the United States?', answer: 'Washington, D.C.', qId: 1 },
            { question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island', qId: 2 },
            { question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states', qId: 3 },
            { question: 'When do we celebrate Independence Day?', answer: 'July 4', qId: 4 },
            { question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans', qId: 5 }, // duplicate.
            { question: 'What is one right or freedom from the First Amendment?', answer: 'Any of: speech, religion, assembly, press, petition the government', qId: 6 },
            { question: 'What is the economic system in the United States?', answer: 'Either of: capitalist economy, market economy', qId: 7 },
            { question: 'Name one branch or part of the government.', answer: 'Any of: Congress, legislative, President, executive, the courts, judicial', qId: 7 },
            { question: 'What are the two parts of the U.S. Congress?', answer: 'the Senate and House (of Representatives)', qId: 9 },
            { question: 'Who is one of your state’s U.S. Senators now?', answer: 'varies depending on your state. See https://en.wikipedia.org/wiki/List_of_current_United_States_Senators', qId: 10 }, // Use list entity recognizer
            { question: 'In what month do we vote for President?', answer: 'November', qId: 11 },
            { question: 'What is the name of the President of the United States now?', answer: 'Any of: Donald J. Trump, Donald Trump, Trump', qId: 12 },
            { question: 'What is the capital of your state?*', answer: '', qId: 13 }, // Use list entity recognizer
            { question: 'What are the two major political parties in the United States?', answer: 'Democratic and Republican', qId: 14 },
            { question: 'What is one responsibility that is only for United States citizens?', answer: 'serve on a jury, or vote in a federal election', qId: 15 },
            { question: 'How old do citizens have to be to vote for President?', answer: 'eighteen (18) and older', qId: 16 },
            { question: 'When is the last day you can send in federal income tax forms?', answer: 'April 15', qId: 17 },
            { question: 'Who was the first President?', answer: '(George) Washington', qId: 18 },
            { question: 'What was one important thing that Abraham Lincoln did?', answer: 'freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War', qId: 19 }, // Use Intent recognizer
            { question: ' Name one war fought by the United States in the 1900s.', answer: 'World War I, World War II, Korean War, Vietnam War, (Persian) Gulf War', qId: 20 },  // List entity or phrase list
            { question: 'What did Martin Luther King, Jr. do?', answer: 'fought for civil rights, worked for equality for all Americans', qId: 21 },  // Intent recognizer
            /* { question: 'What does the President’s Cabinet do?', answer: 'advises the President', qId: 35 },
            { question: '', answer: '', qId: 23 },
            { question: '', answer: '', qId: 24 },
            { question: '', answer: '', qId: 25 },
            { question: '', answer: '', qId: 26 }, 
            { question: 'What are two cabinet-level positions', answer: 'Secretary of State, Secretary of Labor', qId: 36 }
            */
            // --- begin slightly harder questions

        ];

        /**
         * shuffle the questions
         */
        session.conversationData.questions = shuffle(session.conversationData.questions);
        /**
         * Ask for the difficulty level.
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
        var demo = 0;
        var prompt = '';
        var spoken_prompt = '';
        if (demo) {
            prompt = '__Difficulty Level__';
            spoken_prompt = 'Do you want easy questions, hard ones, or a combination of both?';
        } else {
             prompt = 'choose_level';
             spoken_prompt = 'choose_level_ssml';
           
        }
        builder.Prompts.choice(session, prompt, choices, { 
            speak: speak(session, spoken_prompt) 
        });
    },
    function (session, results) {
        // Store users input
        // - The response comes back as a find result with index & entity value matched.
        var test = session.dialogData.test;
        test.level = results.response.entity;  // Question - does this entity have to do with my LUIS model?
        session.conversationData.test = test;
        /**
         * Ask for number of questions to ask.
         * 
         * - We can use gettext() to format a string using a template stored in our
         *   localized prompts file.
         * - The number prompt lets us pass additional options to say we only want
         *   integers back and what's the min & max value that's allowed.
         */
        var demo = 0;
        var prompt = '';
        var spoken_prompt = '';
        if (demo) {
            prompt = 'How many questions?';
            spoken_prompt = 'How many questions? Choose a number from 1 to ten.';
        } else {
            prompt = session.gettext('choose_count_questions', test.level);
            spoken_prompt = 'choose_count_ssml'  // TODO: UPDATE
        }
        builder.Prompts.number(session, prompt, {
            speak: speak(session, spoken_prompt),
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
        // session.conversationData.test.count = test.count;
        /**
         * Start the quiz we just initialized.
         * 
         * We can use replaceDialog() to end the current dialog and start a new
         * one in its place. We can pass arguments to dialogs so we'll pass the
         * 'TakeTestDialog' the test we created.
         */
        // session.replaceDialog('TakeTestDialog', { test: test });
        test.turns++;
        session.conversationData.turns++; 
        test.current_question_index = 0;
        session.conversationData.test = test;
        session.replaceDialog('AskQuestionDialog' , { test: test }); 
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
/*
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
            .subtitle('Ok!') //.subtitle(test.count > 1 ? 'card_subtitle_plural_questions' : 'card_subtitle_singular_questions')
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
            session.replaceDialog('AskQuestionDialog'); // replaceDialog('PlayGameDialog', { game: game });
        //}
    } else {
        // User started session with "start over" so let's just send them to
        // the 'CreateTestDialog'
        session.replaceDialog('CreateTestDialog');
    }
}).triggerAction({ matches: /start over| restart | repeat /i });
*/

/**
 * Ask the quiz questions in a loop
 * 
 * 
 */
bot.dialog('AskQuestionDialog', [
    function (session, args) {
        var debug = 0;
        var current_question_index = 0;
        var test_question = 'used for debugging only';
        var score = session.conversationData.test.score;

        /**
         * TODO: Handle the case in which a user says Next but is not inside a test.
         */
        if (session.conversationData.questions == undefined || session.conversationData.questions == null) {
            // SHOULDN'T BE HERE
            console.log('AskQuestionDialog: conversationData.questions was undef or null.')
            session.conversationData.questions = [
                // Questions for those over 65 who have lived in the states for over 20 years.
                { question: 'What is the capital of the United States?', answer: 'Washington, D.C.', qId: 1 },
                { question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island', qId: 2 },
                { question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states', qId: 3 },
                { question: 'When do we celebrate Independence Day?', answer: 'July 4', qId: 4 },
                { question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans', qId: 5 },
                { question: 'What is one right or freedom from the First Amendment?', answer: 'Any of: speech, religion, assembly, press, petition the government', qId: 6 },
                { question: 'What is the economic system in the United States?', answer: 'Either of: capitalist economy, market economy', qId: 7 },
                { question: 'Name one branch or part of the government.', answer: 'Any of: Congress, legislative, President, executive, the courts, judicial', qId: 7 },
                { question: 'What are the two parts of the U.S. Congress?', answer: 'the Senate and House (of Representatives)', qId: 9 },
                { question: 'Who is one of your state’s U.S. Senators now?', answer: 'varies depending on your state. See https://en.wikipedia.org/wiki/List_of_current_United_States_Senators', qId: 10 }, // Use list entity recognizer
                { question: 'In what month do we vote for President?', answer: 'November', qId: 11 },
                { question: 'What is the name of the President of the United States now?', answer: 'Any of: Donald J. Trump, Donald Trump, Trump', qId: 12 },
                { question: 'What is the capital of your state?*', answer: '', qId: 13 }, // Use list entity recognizer
                { question: 'What are the two major political parties in the United States?', answer: 'Democratic and Republican', qId: 14 },
                { question: 'What is one responsibility that is only for United States citizens?', answer: 'serve on a jury, or vote in a federal election', qId: 15 },
                { question: 'How old do citizens have to be to vote for President?', answer: 'eighteen (18) and older', qId: 16 },
                { question: 'When is the last day you can send in federal income tax forms?', answer: 'April 15', qId: 17 },
                { question: 'Who was the first President?', answer: '(George) Washington', qId: 18 },
                { question: 'What was one important thing that Abraham Lincoln did?', answer: 'freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War', qId: 19 }, // Use Intent recognizer
                { question: ' Name one war fought by the United States in the 1900s.', answer: 'World War I, World War II, Korean War, Vietnam War, (Persian) Gulf War', qId: 20 },  // List entity or phrase list
                { question: 'What did Martin Luther King, Jr. do?', answer: 'fought for civil rights, worked for equality for all Americans', qId: 21 },  // Intent recognizer
                /* { question: 'What does the President’s Cabinet do?', answer: 'advises the President', qId: 35 },
                { question: '', answer: '', qId: 23 },
                { question: '', answer: '', qId: 24 },
                { question: '', answer: '', qId: 25 },
                { question: '', answer: '', qId: 26 }, 
                { question: 'What are two cabinet-level positions', answer: 'Secretary of State, Secretary of Labor', qId: 36 }
                */
                // --- begin slightly harder questions

            ];
        }

        try {
            current_question_index = session.conversationData.test.current_question_index;
            test_question = sprintf('Got into Ask Question dialog and first question is: %s', session.conversationData.questions[current_question_index].question);
        } catch (error) {            
            var message = error.message
            var stack = error.stack;
            var code = error.code;
            session.say(message + code + stack, message);
        }
        if (debug ) {
            console.log('*******\nDebug: %s. \n*****\n', test_question); 
            session.say(null, test_question);  
        }
        // get our current index into the question list.

        if (current_question_index < session.conversationData.test.count) { 
            var question = session.conversationData.questions[current_question_index].question;  // TODO: handle undefined question
            var qId = session.conversationData.questions[current_question_index].qId; 
            session.dialogData.qId = qId;
            var dbg_question = 'debug: ' + question;
            console.log('*******\nQuestion #%d is %s. \n*****\n', current_question_index, question); 
            // ask the question
            if (debug) {
                session.say(dbg_question, dbg_question);
                // session.say(session.message.text,session.message.text);
            } 
              // builder.Prompts.text(session, question);
              builder.Prompts.text(session, question, {            
                    speak: question,
                    retrySpeak: question,
                    inputHint: builder.InputHint.expectingInput
              });
        } else {
            /*      
             *   We're done (ind==count).       
             *   */ 
            console.log('Index is %d, about to finish', current_question_index); 
            var demo = 1;
            var count = session.conversationData.test.count;
            if (demo ) {
                // TODO: if (easy) {}
                var strScore = sprintf('Your score is %f out of %d', session.conversationData.test.score, count);
                session.say(strScore, strScore);  
                // TODO: else {}
            }


            // TODO: Display score.
            session.replaceDialog('HelpDialog', {test: session.conversationData.test, msg: 'Do you want another test?'});
        }
    },
    function (session, results) {
        var dbg = 0;
        var lastUtterance = results.response;
        // session.send('Ok, sounds like your answer was: %s', lastUtterance);
        var textToEcho = sprintf("I heard your last answer as: %s", lastUtterance);

        // Adjust goodOKBad based on either LUIS intent confidence score or regex or a combination of both.
        var goodOKBad = 'That answer was OK.';
        var qId = session.dialogData.qId;        
        var curr_q_score = judgeAnswer(qId, lastUtterance); 

        // update total score
        session.conversationData.test.score += curr_q_score;

        if (curr_q_score > .6) {
            goodOKBad = 'Good answer';
        } else if (curr_q_score > .4) {
            goodOKBad = 'That answer was OK';
        } else {
            goodOKBad = 'Hmm, I\'m not sure about that answer.';
        }
        // TODO: Speak the correct answer based on curr_q_score

        var nextTip = ' * Click or say Next for the next question.';

        var officialAnswer = session.conversationData.questions[session.conversationData.test.current_question_index].answer;
        var txtOfficialAnswer = sprintf('The official answer is: %s', officialAnswer);
        txtOfficialAnswer = txtOfficialAnswer + nextTip;

        if (dbg) {
            session.say(textToEcho, goodOKBad, { inputHint: builder.InputHint.ignoringInput });  
            // TODO: rate answer based on intent score
            session.say(txtOfficialAnswer, txtOfficialAnswer, { inputHint: builder.InputHint.ignoringInput } ); 
            // TODO: put textToEcho in the card to display - So, putting many fields in one card.
        }

        var card = new builder.HeroCard(session)
            .subtitle(textToEcho) // echo what we heard in subtitle.
            .buttons([ // for question help
                //builder.CardAction.imBack(session, 'repeat this question', 'Repeat Question'), // TODO replace buttons
                //builder.CardAction.imBack(session, 'help with this question', 'Help with Question'),
                builder.CardAction.imBack(session, 'Next', 'Next')
            ]);

            // Adjust the sentiment of this string based on calculated intent
            card.title(goodOKBad);

              
            // show official answer in card
            card.text(txtOfficialAnswer);
        
        var msg = new builder.Message(session).addAttachment(card);
            // Build up spoken response to that answer.
            var spoken = goodOKBad;
            msg.speak(ssml.speak(spoken));   // ****** TODO - Check if this is the spoken tip if they didn't get the answer right **** 
            msg.text = 'MSG.TEXT';

            // is ignoringInput the problem?
            msg.inputHint(builder.InputHint.acceptingInput);    

            session.conversationData.test.current_question_index++; // increment count if we got a recognized result.
            session.send(msg).endDialog(); //.endDialog(); 
        /************* END CARD */



        // We repeat displaying the dialog without requiring the Next button 
        // if there's no display
        var hasDisplay = 1;
        if (!hasDisplay) {
          // Ask another question 
          session.replaceDialog('AskQuestionDialog');
        }
    }
]).triggerAction({ matches: /Next/i});; // TODO BUGBUG: Pass test structure with score dialogArgs: {test: session.conversationData.test}



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
    var demo = 0;
    var help_title = '';
    var help_ssml = '';
    if (demo) {
        help_title ='Test Options';
        // session.conversationData.test.turns
        if (session.conversationData.turns > 0 ) {
            help_ssml = 'Do you want to try another quiz? To take another test, say repeat.'
        } else {
           help_ssml = 'I can give you quiz questions from the US citizenship exam. To start, say take a test.';
        }

    } else {
        help_title = 'help_title';
        help_ssml = 'help_ssml';
    }
    var card = new builder.HeroCard(session)
        .title(help_title)
        .buttons([
            builder.CardAction.imBack(session, 'take test', 'New Test'),
            builder.CardAction.imBack(session, 'repeat', 'Repeat Previous Test')
        ]);
    var msg = new builder.Message(session)
        .speak(speak(session, help_ssml))
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

/** 
 * Returns a number between 0 and 1 that indicates the confidence that the answer was correct.
 * 
 * For some questions, it's enough to check that the answer contains specified substrings, or matches a pattern.
 * 
 * For other more complex questions, we will pass the answer to an intent recognition service (LUIS).
 * The LUIS model has been trained on labeled sets of correct and incorrect answers. 
 * LUIS provides a confidence score on the correctness of the answer, and extracts relevant entities from the utterance.
 * 
 */
function judgeAnswer(qId, utterance) {

    var score = 0;
    luisScore = 0;
    entitiesMatched = 0;
    switch (qId)
    {
        case(1):
            console.log('judgeAnswer: qId ==1');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/\w*(Washington).+(D\.*\s*C\.*|District of Columbia)\w*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    if (utterance.match(/\w*(Washington)\w*/i) || utterance.match(/D\.*\s*C\.*|District\s*\w*\s*(Columbia)\w*/i)) {
                        score = 0.5;
                        console.log('judgeAnswer: partial match on utterance=%s', utterance);
                        return score;
                    } else {
                        console.log("no match for qId=1, utterance=%s", utterance);
                    }
                   
                }
                if (match !== null) {
                    var arrayLength = match.length;
                    for (var i = 0; i < arrayLength; i++) {
                        console.log('QID:%d, Matched %s.', qId, match[i]);
                    }
                }
            } else {
                console.log("null utterance for qId=1");
            }
            return score;
            
        case(2):
            score = 1;
            return score;

        case(3):
            score = 1;
            return score;

        // These are questions requiring LUIS    
        case(qId > 10):
        // luisScore = getLuisScore(qId, utterance)
        
        default:
    }
    return 0;
}

/**
 * 
 * Used like so:
 * var arr = [2, 11, 37, 42];
 * arr = shuffle(arr);
 * console.log(arr);
 * 
 * @param {*} array 
 */
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

