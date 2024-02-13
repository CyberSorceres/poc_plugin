//import { error } from 'console';
//import { report } from 'process';
import * as vscode from 'vscode';

//class for the user stories
class UserStory {
	tag: string;
	content: string;
	description: string;

	constructor(tag: string, content: string) {
		this.tag = tag;
		this.content = content;
		this.description = '';
	}

	// print the user story as VSCODE information message
	print() {
		vscode.window.showInformationMessage(`Tag: ${this.tag}, Content: ${this.content}`);
	}

	logUserStory() {
		console.log(`Tag: ${this.tag}, Content: ${this.content}`);
	}

	setTag(tag: string) {
		this.tag = tag;
	}

	setContent(content: string) {
		this.content = content;
	}

	setDescription(description: string) {
		this.description = description;
	}

	getTag() {
		return this.tag;
	}

	getContent() {
		return this.content;
	}

	getDescription() {
		return this.description;
	}
}

// Function to parse the open file for tags
function parseFileForTags(document: vscode.TextDocument): [UserStory[], string]{
	const userStories: UserStory[] = [];
	const initialTagRegex = /@USERSTORY-(\d+)/g;
	//end tag is @USERSTORY-END then a newline
	const endTagRegex = /@USERSTORY-END/g;

	let report:  string = '';
	let loadingContent = false;
	let currentLineLogged = 0;

	//for each line in the file check if it contains a start tag
	for (let i = 0; i < document.lineCount; i++) {
		const line = document.lineAt(i);
		const text = line.text;

		switch(true) {
			case endTagRegex.test(text): //found an END tag
				if(loadingContent) { //if I'm already loading content, stop loading the content -> I found the end tag
					loadingContent = false;
					if(currentLineLogged === 0) {
						report += `Error: No content found for user story ${userStories.length}\n`;
					}
				}
				else { //if I'm not loading content, report an error, -> I found an end tag before a start tag
					report += `Error: End tag found before start tag on line ${i+1}\n`;
				}
				break;
			case initialTagRegex.test(text): //found a START tag
				if(loadingContent) { //if the line contains a start tag and im already loading content, report an error -> I found a start tag before an end tag
					report += `Error: Start tag found before end tag on line ${i+1}\n`;
				}
				else { //if the line contains a start tag and im not loading content, start loading the content -> I found a new user story
					//extract the number from the tag
					let tagNumber = text.match(initialTagRegex)![0].split('-')[1];
					userStories.push(new UserStory(tagNumber, ''));
					loadingContent = true;
					currentLineLogged = 0;
				}
				break;
			default: //found CONTENT
				if(loadingContent) { //if im loading content, add the line to the user story content
					userStories[userStories.length - 1].content += text + '\n';
					//console.log('logged line number: ' + i + ' in user story number: ' + (userStories.length - 1));
					currentLineLogged++;
				}
				break;
		}

	}

	//return the user stories and the error report, if the error report is undefined, the file was parsed without errors, then return "No errors found"
	return [userStories, report === '' ? 'No errors found' : report];

}

function connectToDB() {
	//connect to the database

}

function getUserStoriesFromDB(UserStories: UserStory[]) {

	//for esch user story, get the description from the database

}


// COMMAND runtTests: Run the tests for the user story tags in the current file
async function runTests() {
	
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active text editor');
        return;
    }

    const document = editor.document;
	//vscode.window.showInformationMessage(`Document: ${document.fileName}`); //Print the file name

	//parse the file. assign the result to a variable
	let [US, errorReport] = parseFileForTags(document);



	console.log(errorReport);

	if(US.length === 0) {
		vscode.window.showErrorMessage('No tags found in current file', 'OK');
		return;
	}
	
	//for each user story print the tag and the content
	if(errorReport === 'No errors found') { //if there are no errors, print the user stories
		US.forEach((story) => {
			story.print();
			story.logUserStory();	
		});
	}
	else { //if there are errors, print the error report
		vscode.window.showErrorMessage('There are errors in the file, check the output console for more information', 'OK');
	}

	getUserStoriesFromDB(US);


}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {

	console.log('Extension "exttest" is now active!'); 

	let disposable = vscode.commands.registerCommand('exttest.runTests', runTests);

	connectToDB();

	/*
	const disposable2 = vscode.commands.registerCommand('exttest.showSidebar', () => {
		// Create and show a new webview panel
		Create and show a new webview panel as a sidebar
		const panel = vscode.window.createWebviewPanel(
			'sidebar', // Identifies the type of the webview. Used internally
			'USER STORIES EXT', // Title
			vscode.ViewColumn.One, // Editor column to show the new webview panel in
			{
				// Enable scripts in the webview
				enableScripts: true
			}
		);

	
		// Get the path to your HTML file
		const htmlPath = vscode.Uri.file(context.asAbsolutePath('src/sidebar.html'));
	
		// Read the HTML file as a string
		const htmlContent = vscode.workspace.fs.readFile(htmlPath).then(buffer => buffer.toString());
	
		// Set the HTML content to the webview panel
		htmlContent.then(content => {
			panel.webview.html = content;
		});
	
		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(message => {
			// Handle button click events
			switch (message.command) {
				case 'runTestsButtonClicked':
					runTests;
					break;
			}
		});
	}); 

	context.subscriptions.push(disposable2);	
	vscode.commands.executeCommand('exxttest.showSidebar');*/
}

export function deactivate() {}
