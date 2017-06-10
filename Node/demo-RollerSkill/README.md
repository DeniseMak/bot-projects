# LING 575 project: Citizenship Quiz Cortana Skill and Speech-enabled WebChat Control

For the project description and write-up see: https://aka.ms/dmak-sds-575-description
For the running demo see: https://aka.ms/dmak-sds-575-test

The webchat-control folder contains the Web Chat Control, and the cortana-skill folder contains the server-side bot dialogs that both the Web Chat Control and Cortana would communicate with.

## Web Chat Control 

Embeddable web chat control for giving quiz questions from the US naturalization exam, built using the [Microsoft Bot Framework](http://www.botframework.com) and the [DirectLine](https://docs.botframework.com/en-us/restapi/directline3/) API.
It is based on the project here: https://github.com/Microsoft/BotFramework-WebChat

* Note: The web chat control only works in the Chrome browser. 
Safari does not yet support the speech API it uses.

The web control is a front end to a bot runs as a web service similar to  [Azure Bot Service](https://azure.microsoft.com/en-us/services/bot-service/)


It is not necessary for you to build the project in order to run it, because you can just run the web chat control from a web page. The instructions and live web control are posted are at: https://aka.ms/dmak-sds-575-test. This web control is easier to test if you don�t want to install Cortana on your phone or computer.

To run the web control locally, copy voice-test.html, botchat.js, and botchat.css to your locally running web server, and open voice-test.html with the following key appended to the URL, as shown in this URL: http://students.washington.edu/dpm3/voice-test.html?s=tuBISJY4UhI.cwA.RlY.8fj5FJK_9yK6J4LB-JaaJAPdZVqQ9DB_jP6ysYn6DIo


## Cortana Skill
You can run the Cortana skill by saying “Ask Citizenship for a test” to Cortana on IPhone, Android, or Windows 10. You need to use a test account to log into Cortana on your device (see this link for a screenshot of the UI for changing your login) since the skill isn’t publicly available yet. The test account is username: chatbot.test@outlook.com password: CortanaTest

To run this locally, you will need to have node.js installed. The main file is app.js. In the directory of app.js, run the following:

npm init
npm install --save botbuilder
npm install --save restify
node.js app.js

This should start a web service locally. If successful your node.js prompt will show a message like:
restify listening to http://[::]:3978

To see a bot interacting with the service locally, you can download an emulator, described here: https://docs.microsoft.com/en-us/bot-framework/debug-bots-emulator