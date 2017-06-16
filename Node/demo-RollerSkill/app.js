/*-----------------------------------------------------------------------------
This project is a Cortana skill for practicing for the US Naturalization exam. 
-----------------------------------------------------------------------------*/
const LUISClient = require("./luis_sdk");

const APPID_nav = "13f573e0-8c13-45a3-86a2-b84b1c7b02e3";
const APPID_19 = "2a7e6e0e-8199-4350-a6b7-9b2fe9ffc18a";
const APPID_20 = "030e345e-aa6c-4e16-8399-fb718f30b898";
const APPID_21 = "036b4521-11aa-494f-9920-77a243a87dea";
const APPID_10 = "3ccae9a8-ba4d-4c88-8c3c-ff10cd43dbcf";
const APPID_13 = "1ac8988a-7643-47c7-9b1d-d6e71eb7bd50";
const APPKEY = "9823b75a8c9045f9bce7fee87a5e1fbc";


// To debug a question: shuffle_on is set 0 to disable shuffling of question order,
// and put the questions first in the questions array in CreateTestDialog.
const DEBUG = 1;
var shuffle_on = 1;
if (DEBUG) {
    shuffle_on = 0;
} 

var restify = require('restify');
var builder = require('botbuilder');
var sprintf = require("sprintf-js").sprintf;
var util = require('util');
var ssml = require('./ssml');

// set up LUIS client for various answer models
var LUISclient_nav = LUISClient({
    appId: APPID_nav,
    appKey: APPKEY,
    verbose: true
});

var LUISclient19 = LUISClient({
    appId: APPID_19,
    appKey: APPKEY,
    verbose: true
});

var LUISclient20 = LUISClient({
    appId: APPID_20,
    appKey: APPKEY,
    verbose: true
});

var LUISclient21 = LUISClient({
    appId: APPID_21,
    appKey: APPKEY,
    verbose: true
});

var LUISclient10 = LUISClient({
    appId: APPID_10,
    appKey: APPKEY,
    verbose: true
});

var LUISclient13 = LUISClient({
    appId: APPID_13,
    appKey: APPKEY,
    verbose: true
});

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

    session.conversationData.turns = 0;
    // Just redirect to our 'HelpDialog'.
    session.replaceDialog('HelpDialog');
});

// Enable Conversation Data persistence
bot.set('persistConversationData', true);

/**
 * This dialog sets up a test for the bot to administer.  It will 
 * ask the user for the difficulty level. 
 * The difficulty level is currently not used, but could eventually include:
 *   -- choosing from a harder set of questions
 *   -- Whether or not text is displayed in English and/or their native language 
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
    function (session, args) {
        // Initialize quiz structure.
        // - conversationData gives us storage of data in between
        //   turns with the user.
        var debug_qIndex = 0;
        var debug_flag = 0;


        var current_turns = 0;
        if (session.conversationData.test !== undefined && session.conversationData.test.turns !== undefined) {
            current_turns = session.conversationData.test.turns;
        }
        var test = session.conversationData.test = {
            type: 'custom',
            level: null,
            count: null, // total number of questions the user wants to do.
            questions_picked: {},
            current_question_index: 0,
            turns: current_turns,
            num_questions: 0,
            score: 0
        };



        session.dialogData.test = test;  // TODO: Not using dialogdata anymore

        /* TODO: MOVE TO DEFAULT DIALOG */
        session.conversationData.questions = [
            // Questions for those over 65 who have lived in the states for over 20 years.
            { question: 'What was one important thing that Abraham Lincoln did?', answer: 'freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War', qId: 19 }, 
            { question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans', qId: 5 },
            { question: 'What is the capital of the United States?', answer: 'Washington, D.C.', qId: 1 },
            { question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island', qId: 2 },
            { question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states', qId: 3 },  // often misheard as 450
            { question: 'When do we celebrate Independence Day?', answer: 'July 4', qId: 4 },
            //{ question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans', qId: 5 }, // Intent recognizer
            { question: 'What is one right or freedom from the First Amendment?', answer: 'Any of: speech, religion, assembly, press, petition the government', qId: 6 },
            { question: 'What is the economic system in the United States?', answer: 'Either of: capitalist economy, market economy', qId: 7 },
            { question: 'Name one branch or part of the government.', answer: 'Any of: Congress, legislative, President, executive, the courts, judicial', qId: 8 },
            { question: 'What are the two parts of the U.S. Congress?', answer: 'the Senate and House (of Representatives)', qId: 9 },
            { question: 'Who is one of your state’s U.S. Senators now?', answer: 'varies depending on your state. See https://en.wikipedia.org/wiki/List_of_current_United_States_Senators', qId: 10 }, // Use list entity recognizer
            { question: 'In what month do we vote for President?', answer: 'November', qId: 11 },
            { question: 'What is the name of the President of the United States now?', answer: 'Any of: Donald J. Trump, Donald Trump, Trump', qId: 12 },
            { question: 'What is the capital of your state?', answer: '', qId: 13 }, // Use list entity recognizer
            { question: 'What are the two major political parties in the United States?', answer: 'Democratic and Republican', qId: 14 },
            { question: 'What is one responsibility that is only for United States citizens?', answer: 'serve on a jury, or vote in a federal election', qId: 15 },
            { question: 'How old do citizens have to be to vote for President?', answer: 'eighteen (18) and older', qId: 16 },
            { question: 'When is the last day you can send in federal income tax forms?', answer: 'April 15', qId: 17 },
            { question: 'Who was the first President?', answer: '(George) Washington', qId: 18 },
            //{ question: 'What was one important thing that Abraham Lincoln did?', answer: 'freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War', qId: 19 }, // Use Intent recognizer
            { question: ' Name one war fought by the United States in the 1900s.', answer: 'World War I, World War II, Korean War, Vietnam War, (Persian) Gulf War', qId: 20 },  // List entity or phrase list
            { question: 'What did Martin Luther King, Jr. do?', answer: 'fought for civil rights, worked for equality for all Americans', qId: 21 }  // Intent recognizer
            /* { question: 'What does the President’s Cabinet do?', answer: 'advises the President', qId: 35 },
            { question: 'What are two cabinet-level positions', answer: 'Secretary of State, Secretary of Labor', qId: 36 }
            */
            // --- begin slightly harder questions

        ];


        /**
         * shuffle the questions
         */
        if (shuffle_on) {
            session.conversationData.questions = shuffle(session.conversationData.questions);
        }


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
            { value: 'hard', action: { title: 'Harder' }, synonyms: 'hard|hard ones|hard questions|harder|harder ones|harder questions' },
        ];
        var demo = 0;
        var prompt = '';
        var spoken_prompt = '';
        if (demo) {
            prompt = '__Difficulty Level__';
            spoken_prompt = 'Do you want easy questions or harder ones?';
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
        session.replaceDialog('AskQuestionDialog', { test: test });
    }
]).triggerAction({
    matches: [
        /.*(text|test|exam|interview|quiz|practice)/i,
        /new test/i, /repeat test/i
    ]
});

/**
 * Example of trigger action
 */
/*
bot.dialog('TakeTestDialog', function (session, args) {

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
            // SHOULDN'T BE INSIDE THIS IF
            console.log('AskQuestionDialog: conversationData.questions was undef or null.')
            session.conversationData.questions = [
                // Questions for those over 65 who have lived in the states for over 20 years.
                { question: 'What is the capital of the United States?', answer: 'Washington, D.C.', qId: 1 },
                { question: 'Where is the Statue of Liberty?', answer: 'New York (Harbor) or Liberty Island', qId: 2 },
                { question: 'Why does the flag have 50 stars?', answer: 'because there are 50 states', qId: 3 },
                { question: 'When do we celebrate Independence Day?', answer: 'July 4', qId: 4 },
                { question: 'What did Martin Luther King, Jr. do?', answer: 'He fought for civil rights and worked for equality for all Americans', qId: 5 }, // Intent recognizer
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
        if (debug) {
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
            if (demo) {
                // TODO: if (easy) {}
                var strScore = sprintf('Your score is %f out of %d', session.conversationData.test.score, count);
                session.say(strScore, strScore);
                // TODO: else {}
            }


            // TODO: Display score.
            session.replaceDialog('HelpDialog', { test: session.conversationData.test, msg: 'Do you want another test?' });
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
            goodOKBad = 'That answer was not exactly correct.';
        } else {
            goodOKBad = 'I\'m not sure about that answer.';
        }
        // TODO: Speak the correct answer based on curr_q_score

        var nextTip = ' * Click or say Next for the next question.';

        var officialAnswer = session.conversationData.questions[session.conversationData.test.current_question_index].answer;
        var txtOfficialAnswer = sprintf('The official answer is: %s', officialAnswer);
        txtOfficialAnswer = txtOfficialAnswer + nextTip;

        if (dbg) {
            session.say(textToEcho, goodOKBad, { inputHint: builder.InputHint.ignoringInput });
            // TODO: rate answer based on intent score
            session.say(txtOfficialAnswer, txtOfficialAnswer, { inputHint: builder.InputHint.ignoringInput });
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
        msg.inputHint(builder.InputHint.expectingInput);

        session.conversationData.test.current_question_index++; // increment count if we got a recognized result.
        session.send(msg).endDialog(); //.endDialog(); 
        /************* END CARD */



        // We repeat displaying the dialog without requiring the Next button 
        // if there's no display
        // TODO: Automatically detect a screen-less device
        var hasDisplay = 1;
        if (!hasDisplay) {
            // Ask another question 
            session.replaceDialog('AskQuestionDialog');
        }
    }
]).triggerAction({ matches: /Next/i });





/**
 * Every bot should have a help dialog. Ours will use a card with some buttons
 * to educate the user with the options available to them.
 * 
 * TODO: Help should allow the user to decide to change settings like speed and 
 * tooltip display.
 */
bot.dialog('HelpDialog', function (session) {
    var demo = 0;
    // var help_title = '';
    // var help_ssml = '';
    if (demo) {
        help_title = 'Test Options';
        // session.conversationData.test.turns
    } else {
        help_title = 'help_title';
    }

    if (session.conversationData.turns = 0) {
        help_ssml = 'help_ssml_start';
    } else {
        help_ssml = 'help_ssml';
    }
    var card = new builder.HeroCard(session)
        .title(help_title)
        .text('To take a test, click the button or say \'take a test\' To quit, \'say goodbye\'.')
        .buttons([
            builder.CardAction.imBack(session, 'new test', 'New Test'),
            // builder.CardAction.imBack(session, 'repeat test', 'Repeat Previous Test')
        ]);
    var msg = new builder.Message(session)
        .speak(speak(session, help_ssml))
        .addAttachment(card)
        .inputHint(builder.InputHint.acceptingInput);
    session.send(msg).endDialog();
}).triggerAction({ matches: /^help$/i });

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
    switch (qId) {
        case (1):
            console.log('judgeAnswer: qId ==1');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(Washington).+(D\.*\s*C\.*|District of Columbia).*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    if (utterance.match(/.*(Washington).*/i) || utterance.match(/D\.*\s*C\.*|District\s*.*\s*(Columbia).*/i)) {
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

        case (2):
            console.log('judgeAnswer: qId ==2');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*New York(\s+\(?Harbor\)?)?|.*(Liberty Island).*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    return score;
                }
            } else {
                console.log("null utterance for qId=2");
            }
            return score;

        case (3):
            console.log('judgeAnswer: qId ==3'); // 50 states
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*50 state.*|.*(for|each|every|all)\s+.*\s+state.*/i); // try LUIS
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=3");
            }
            return score;

        case (4):
            console.log('judgeAnswer: qId ==4'); // Independence day - entities
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*July 4(th)?.*|.*7\/4.*/i); // try LUIS
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=4");
            }
            return score;

        case (5):
            console.log('judgeAnswer: qId ==5'); // MLK intent
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*civil right.*|.*equality.*/i); // try LUIS
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=5");
            }
            return score;

        case (6):
            console.log('judgeAnswer: qId ==6'); // one right or freedom from 1st Amendment
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(speech|expression).*|.*religion.*|.*(assemble|assembly).*|.*press.*|.*petition.+government.*/i); // try LUIS
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=6");
            }
            return score;

        case (7): // capitalism          
            console.log('judgeAnswer: qId ==7');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(capitalist|capitalism).*|.*market.*/i); // try LUIS
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=7");
            }
            return score;

        case (8): // Name one branch or part of the government: 
            //Congress, legislative, President, executive, the courts, judicial         
            console.log('judgeAnswer: qId ==8');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*congress.*|.*legislative.*|.*president.*|.*executive.*|.*courts.*|/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=8");
            }
            return score;

        case (9): // { question: 'What are the two parts of the U.S. Congress?', 
            // answer: 'the Senate and House (of Representatives)', qId: 9 },   
            console.log('judgeAnswer: qId ==9');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*Senate.*|.*House( of Representatives)?.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=9");
            }
            return score;

        /**
         * { question: 'Who is one of your state’s U.S. Senators now?', 
         * answer: 'varies depending on your state. See https://en.wikipedia.org/wiki/List_of_current_United_States_Senators', qId: 10 }, // Use list entity recognizer    
            */
        case (10):
            console.log('judgeAnswer: qId ==10');
            if (utterance !== undefined && utterance !== null) {

                /*
                var intentName = '';
                LUISclient10.predict(utterance, {

                    //On success of prediction
                    onSuccess: function (response) {
                        intentName = printOnSuccess(response); // returns top scoring intent name
                    },

                    //On failure of prediction
                    onFailure: function (err) {
                        console.log(err);
                    }
                });

                // TODO: Need to handle this asynchronously.
                if (intentName === 'CorrectAnswer') {
                    console.log('LUIS qId10: CorrectAnswer');
                    return 1;
                }
                */
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*Murray.*|.*Cantwell.*/i); // TODO Use LUIS model
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=10");
            }
            return score;

        case (11): // In what month do we vote for President?
            console.log('judgeAnswer: qId ==11');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*November.*|.*nov.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=11");
            }
            return score;

        case (12): // What is the name of the President of the United States now?
            console.log('judgeAnswer: qId ==12');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*Trump.*|.*Donald Trump.*|.*Donald J(\.)? Trump.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=12");
            }
            return score;

        case (13): // 'What is the capital of your state?'
            console.log('judgeAnswer: qId ==13');
            if (utterance !== undefined && utterance !== null) {

                /*
                var intentName = '';
                
                LUISclient13.predict(utterance, {

                    //On success of prediction
                    onSuccess: function (response) {
                        intentName = printOnSuccess(response); // returns top scoring intent name
                    },

                    //On failure of prediction
                    onFailure: function (err) {
                        console.log(err);
                    }
                });

                // TODO: Need to handle this asynchronously.
                if (intentName === 'CorrectAnswer') {
                    console.log('LUIS qId13: CorrectAnswer');
                    return 1;
                }
                */

                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*Olympia.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=13");
            }
            return score;

        case (14): // 'What are the two major political parties?'
            console.log('judgeAnswer: qId ==14');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*Democrat.+Republican.*|.*Republican.+Democrat.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=14");
            }
            return score;

        case (15): // What is one responsibility that is only for United States citizens?
            console.log('judgeAnswer: qId ==15');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*jury.*|.*(vote|voting).*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=15");
            }
            return score;

        case (16): // How old do citizens have to be to vote for President?
            console.log('judgeAnswer: qId ==16');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*eighteen.*|.*18.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=16");
            }
            return score;

        case (17): // last day for income tax
            console.log('judgeAnswer: qId ==17');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*April fifteen.*|.*April 15.*|.*4-15.*|.*4\/15.*|.*15.*Apr.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=17");
            }
            return score;

        case (18): // Who was the first president
            console.log('judgeAnswer: qId ==18');
            if (utterance !== undefined && utterance !== null) {
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(George )?Washington.*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=18");
            }
            return score;

        /**
         * 'freed the slaves (Emancipation Proclamation), 
         saved (or preserved) the Union, 
         led the United States during the Civil War'
         */
        case (19): // What was one important thing that Abraham Lincoln did?
            console.log('judgeAnswer: qId ==19');
            if (utterance !== undefined && utterance !== null) {

                var intentName = '';
                LUISclient19.predict(utterance, {

                    //On success of prediction
                    onSuccess: function (response) {
                        intentName = printOnSuccess(response); // returns top scoring intent name
                    },

                    //On failure of prediction
                    onFailure: function (err) {
                        console.error(err);
                    }
                });

                // TODO: Need to handle this asynchronously.
                if (intentName === 'CorrectAnswer') {
                    console.log('LUIS qId19: CorrectAnswer');
                    return 1;
                }


                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(save|preserve).*(union|country|nation).*|.*emancipation proclamation.*|(free|emancipate|liberate).*slave*.*|(end|abolish).*slavery.*/i);
                if (match !== null) {
                    score = 1;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    // return score;
                }

            } else {
                console.log("null utterance for qId=19");
            }
            return score;
        case (20): //
            /** 
             * ' Name one war fought by the United States in the 1900s.', 
             * answer: 'World War I, World War II, Korean War, Vietnam War, (Persian) Gulf War'
             */
            console.log('judgeAnswer: qId ==20');
            if (utterance !== undefined && utterance !== null) {

                /*
                var intentName = '';
                LUISclient20.predict(utterance, {

                    //On success of prediction
                    onSuccess: function (response) {
                        intentName = printOnSuccess(response); // returns top scoring intent name
                    },

                    //On failure of prediction
                    onFailure: function (err) {
                        console.log(err);
                    }
                });

                // TODO: Need to handle this asynchronously.
                if (intentName === 'CorrectAnswer') {
                    console.log('LUIS qId20: CorrectAnswer');
                    return 1;
                }
                */
                console.log('judgeAnswer: utterance = %s', utterance);
                var match = utterance.match(/.*(world war|ww)\s*((I|1|one)|(II|2|two)).*|.*korea.*|.*vietnam.*|.*(persian|gulf|iraq).*/i);
                if (match !== null) {
                    score = 1;
                    return score;
                } else {
                    score = 0;
                    console.log('judgeAnswer: Didn\'t match utterance = %s', utterance);
                    return score;
                }
            } else {
                console.log("null utterance for qId=20");
            }
            return score;
        case (qId > 20):
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


bot.endConversationAction('goodbyeAction', "Ok... See you later.", { matches: /Goodbye/i });

var printOnSuccess = function (response) {
    console.log("Query: " + response.query);
    console.log("Top Intent: " + response.topScoringIntent.intent);
    console.log("Entities:");
    for (var i = 1; i <= response.entities.length; i++) {
        console.log(i + "- " + response.entities[i - 1].entity);
    }
    return response.topScoringIntent.intent;
};

/**
 * Listen for a debug string in the form of debug question-index.
 * 
 * While you can use a triggerAction() to start a dialog, you sometimes just want
 * to either send a message when a user says something or start an existing dialog
 * with some arguments. You can use a customAction() to recognize something the user
 * says without tampering with the dialog stack. In our case what we want to do is
 * debug a question by calling AskQuestion with the ID of question to test. 
 */
/*
bot.customAction({
    matches: /^debug\s+[0-9]+/i,
    onSelectAction: function (session, args, next) {

        var question_to_test;
        dbg_strs = session.message.text.match(/debug\s([0-9]+)/i);
        if (dbg_strs !== null) {
            if (dbg_strs[1] !== null && dbg_strs[1] !== undefined) {
                question_to_test = dbg_strs[1]; // 18 Lincoln, 19 Wars
            }

        }

        // The user could be in another dialog so clear the dialog stack first
        // to make sure we end that task.

        session.clearDialogStack().beginDialog('CreateTestDialog', {
            debug: { question_index: question_to_test, count: 1 }
        })
    }
});
*/