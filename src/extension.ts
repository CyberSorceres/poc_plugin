import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'querystring';
const { folderExists, fileExists, createFolder, createFile, wipeFile, getActiveFileName } = require('./utils');

let workingDirectory: string | undefined;
let projectId: string;

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

	mockTest(){
		//vscode.window.showInformationMessage(`Going to generate test for US ${this.tag}`);
	    return chiamataAPIBedrock(this.tag, this.content);
	}
}

function setWorkingDirectory(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        // Assuming you want to use the first workspace folder as the working directory
        workingDirectory = folders[0].uri.fsPath;
        //vscode.window.showInformationMessage('Working directory set successfully.');
    } else {
        vscode.window.showErrorMessage('No workspace folders found.');
    }
}

function getWorkingDirectory(): string | undefined {
    return workingDirectory;
}

// Function to parse the open file for tags
function parseFileForTags(document: vscode.TextDocument): [UserStory[], string]{
	const userStories: UserStory[] = [];
	const projectTagRegex = /@PROJECT-(\d+)/g;
	const initialTagRegex = /@USERSTORY-(\d+)/g;
	//end tag is @USERSTORY-END then a newline
	const endTagRegex = /@USERSTORY-END/g;

	let report:  string = '';
	let loadingContent = false;
	let currentLineLogged = 0;

	//first line of the file must contain project tag
	const firstLine = document.lineAt(0).text;
	if(projectTagRegex.test(firstLine)) {
		projectId = firstLine.match(projectTagRegex)![0].split('-')[1];
		//vscode.window.showInformationMessage('Project tag found: ' + projectId);
	}
	else {
		vscode.window.showErrorMessage('No project tag found: the project tag must appear in the first line of the document');
		return [userStories, 'NO PROJECT TAG WAS FOUND ON THE FIRST LINE'];
	}

	//for each line in the file check if it contains a start tag, startting on the second line
	for (let i = 1; i < document.lineCount; i++) {
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

//TODO
function getUserStoriesFromDB(UserStories: UserStory[]) {

}

// COMMAND runtTests: Run the tests for the user story tags in the current file
async function generateTests() {
	
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

	createTests(US);
}

//given an UserStory array, create a test for each of them
async function createTests(UserStories: UserStory[]) {

	const workingDirectory = getWorkingDirectory();

	if(workingDirectory === undefined)
	{
		vscode.window.showErrorMessage('The working directory is not set, please set it and reload the extension');
		return;
	}

	const testDirectoryPath = path.join(workingDirectory, 'TEST');
	const openFileName = getActiveFileName();
	if(openFileName === undefined)
	{
		vscode.window.showErrorMessage('no file currently open, open a file to gerate it\'s tests');
		return;
	}
	
	const testFileName = openFileName + '.test.ts';
	const testFilePath = path.join(testDirectoryPath, testFileName);


    if (!folderExists(testDirectoryPath)) {
        createFolder(testDirectoryPath);
    }

    if (!fileExists(testFilePath)) {
        createFile(testFilePath);
    } else {
        // Wipe file
        wipeFile(testFilePath);
    }

	fs.appendFileSync(testFilePath, 'import {expect, test} from \'vitest\'\r\n');

	const mockTestPromises: Promise<string | null>[] = [];

    UserStories.forEach(story => {
        mockTestPromises.push(story.mockTest());
    });

	const mockTestResults = await Promise.all(mockTestPromises);

	mockTestResults.forEach(result => {
		if (result !== null) {
			fs.appendFileSync(testFilePath, result);
			fs.appendFileSync(testFilePath, '\r\n');
		}
	});
}

//per il poc utilizza solo la user story
async function chiamataAPIBedrock(UserStoryTag: string, UserStoryID: string) {

	const USdescription = await fetchUserStoriesFromDB(UserStoryID);

	if (USdescription) {
		vscode.window.showInformationMessage(USdescription); // Joining multiple descriptions with a newline
	} else {
		vscode.window.showInformationMessage('No user story description found');
	}

	console.log(`calling API, tag: ${UserStoryTag}`)
    try {
		// Creazione stringa di collegamento
		const stringaPreUserStory = `
Given the following code snippet, replace every instance of #TAG with the tag number
Give me only the code
Code snippet:
test(${USdescription}, () => {
	const UsNumber = #TAG;
	expect(UsNumber).toBe(#TAG);
});
The tag number is ${UserStoryTag}

As a response I only want valid code. Just code, no explanation, no comments, and just one time.
If you give me anything that isn't code, make it a comment
`;      

		console.log(stringaPreUserStory);
        // Costruzione URL dell'endpoint API
        const url = `https://d3ga6czusb.execute-api.eu-central-1.amazonaws.com/dev/bedrock/?message=${encodeURIComponent(stringaPreUserStory)}`;

		// Viene fatta la richiesta all'API e viene salvata la risposta
        const response = await fetch(url);

		// Viene controllata la risposta
        if (!response.ok) {
            throw new Error('Errore nella chiamata API');
        }

		// Ottengo la risposta dell'API in formato JSON
        const data = await response.json() as { results: { outputText: string }[] };

		const outputText = data.results[0].outputText;
		
		// Viene ritornata la risposta dell'API in formato stringa
        return outputText;

		// In caso di errore di collegamento viene mostrato l'errore nel console log e non viene ritornato nulla
    } catch (error) {
        console.error('Si è verificato un errore durante la chiamata API:', error);
        return null;
    }

}

async function fetchUserStoriesFromDB(userStoryid: string) {
	const apiUrl = 'https://d3ga6czusb.execute-api.eu-central-1.amazonaws.com/dev/getUserStory?id=';
	const endPoint = `${apiUrl}${userStoryid}`;

	const response = await fetch(endPoint);

	if (!response.ok) {
		throw new Error('Errore nella richiesta API');
	}

	const jsonResponse = await response.json() as any;
	return JSON.stringify(jsonResponse.descript);
}


function runTests() {
    // Get the currently active workspace folder
    const workspaceFolder = getWorkingDirectory();
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    // Run ViTest command in the integrated terminal
    const terminal = vscode.window.createTerminal('ViTest');
    terminal.sendText('npm test', true);
    terminal.show();
}

function createViTestConfig(): void {
    const workspacePath = getWorkingDirectory();
    if (!workspacePath) {
        vscode.window.showErrorMessage('Cannot generate ViTest configuration: Workspace not found.');
        return;
    }

    const viTestConfigPath = path.join(workspacePath, 'vitest.config.js');
    if (fs.existsSync(viTestConfigPath)) {
        //vscode.window.showWarningMessage('ViTest configuration already exists in the workspace.');
        return;
    }

    // Create package.json if it doesn't exist
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        createPackageJson(packageJsonPath);
    }

    const viTestConfigContent = `
    module.exports = {
        preset: 'ts-jest',
        testEnvironment: 'node',
		testMatch: ['**/TEST/**/*.test.ts'],
    };
    `;

    fs.writeFileSync(viTestConfigPath, viTestConfigContent);
    vscode.window.showInformationMessage('ViTest configuration generated successfully.');
}

function createPackageJson(packageJsonPath: string): void {
    const packageJsonContent = `
    {
        "name": "my-project",
        "version": "1.0.0",
        "description": "My project description",
        "scripts": {
            "test": "vitest"
        },
        "devDependencies": {
            "vitest": "^1.0.0",
            "@types/jest": "^27.0.4",
            "ts-jest": "^27.0.5"
        },
        "contributes": {
            "configuration": {
                "jestrunner.framework": {
                    "type": "string",
                    "default": "vitest",
                    "description": "Specifies the test framework to use for running tests."
                }
            }
        }
    }
    `;

    fs.writeFileSync(packageJsonPath, packageJsonContent);
    vscode.window.showInformationMessage('package.json created successfully.');
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {

	console.log('Extension "exttest" is now active!');

	vscode.workspace.getConfiguration().update('jestrunner.framework', 'vitest', vscode.ConfigurationTarget.Global);

	setWorkingDirectory();
	createViTestConfig();

	let disposable = vscode.commands.registerCommand('exttest.generateTests', generateTests);
	let disposable2 = vscode.commands.registerCommand('exttest.runTests', runTests);
}

export function deactivate() {}