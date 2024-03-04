import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
const { folderExists, fileExists, createFolder, createFile, wipeFile, getActiveFileName } = require('./utils');

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

	mockTest(description: string){
	    return chiamataAPIBedrock(description);
	}
}


let workingDirectory: string | undefined;

function setWorkingDirectory(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        // Assuming you want to use the first workspace folder as the working directory
        workingDirectory = folders[0].uri.fsPath;
        vscode.window.showInformationMessage('Working directory set successfully.');
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
	
	const testFileName = openFileName + '.test.js';
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

	const mockTestPromises: Promise<string | null>[] = [];

    UserStories.forEach(story => {
        mockTestPromises.push(story.mockTest('This is a test for the user story #' + story.tag));
    });

	const mockTestResults = await Promise.all(mockTestPromises);

	mockTestResults.forEach(result => {
		if (result !== null) {
			fs.appendFileSync(testFilePath, result);
		}
	});
}

//per il poc utilizza solo la user story
async function chiamataAPIBedrock(stringaUserStory: string) {
    try {
		// Creazione stringa di collegamento
		const stringaPreUserStory = "Elabora un test, utilizzando il framework vitest, e considerata la seguente user story";
        
		// Combinazione della user story con il codice corrispondente
        const combinazione = stringaPreUserStory + stringaUserStory;
        
        // Costruzione URL dell'endpoint API
        const url = `https://d3ga6czusb.execute-api.eu-central-1.amazonaws.com/dev/bedrock/?message=${encodeURIComponent(combinazione)}`;

		// Viene fatta la richiesta all'API e viene salvata la risposta
        const response = await fetch(url);

		// Viene controllata la risposta
        if (!response.ok) {
            throw new Error('Errore nella chiamata API');
        }

		// Ottengo la risposta dell'API in formato JSON
        const data = await response.json();
		// Dal formato JSON la risposta viene convertita a stringa
		const fromJsonToString = JSON.stringify(data);
		// Viene ritornata la risposta dell'API in formato stringa
        return fromJsonToString;

		// In caso di errore di collegamento viene mostrato l'errore nel console log e non viene ritornato nulla
    } catch (error) {
        console.error('Si è verificato un errore durante la chiamata API:', error);
        return null;
    }
}

async function fetchUserStoriesFromDB(idProject : string) {
	// ENDPOINT API per richiesta user stories da MongoDB
	const urlAPI = 'https://d3ga6czusb.execute-api.eu-central-1.amazonaws.com/dev/getProject?id=${encodeURIComponent(idProject)}';

	try {
		// Viene richiesta la risposta con l'url costruito e viene salvata sulla variabile response
		const response = await fetch(urlAPI);
		// Nel caso di una risposta non valida viene lanciato un errore
		if (!response.ok) {
			throw new Error('Errore nella richiesta API');
		}
		// Le user stories vengono prelevate dalla risposta in formato Json
		const userStories = await response.json();
		// Le user stories vengono convertite a stringa
		const stringUserStories = JSON.stringify(userStories);
		// Vengono ritornate le user stories in formato stringa
		return stringUserStories;
	} catch (error) {
		// In caso di errore viene mostrato in console log l'errore
		console.error('Si è verificato un errore: ', error);
		// Viene ritornato null in caso di errore
		return null;
	}
}

function runTests() {
    // Get the currently active workspace folder
    const workspaceFolder = getWorkingDirectory();
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }

    // Run Jest command in the integrated terminal
    const terminal = vscode.window.createTerminal('Jest');
    terminal.sendText('npm test', true); // or any other Jest command
    terminal.show();
}

function createJestConfig(): void {
    const workspacePath = getWorkingDirectory();
    if (!workspacePath) {
        vscode.window.showErrorMessage('Cannot generate Jest configuration: Workspace not found.');
        return;
    }

    const jestConfigPath = path.join(workspacePath, 'jest.config.js');
    if (fs.existsSync(jestConfigPath)) {
        vscode.window.showWarningMessage('Jest configuration already exists in the workspace.');
        return;
    }

    // Create package.json if it doesn't exist
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        createPackageJson(packageJsonPath);
    }

    const jestConfigContent = `
    module.exports = {
        preset: 'ts-jest',
        testEnvironment: 'node',
		testMatch: ['**/TEST/**/*.test.ts'],
    };
    `;

    fs.writeFileSync(jestConfigPath, jestConfigContent);
    vscode.window.showInformationMessage('Jest configuration generated successfully.');
}

function createPackageJson(packageJsonPath: string): void {
    const packageJsonContent = `
    {
        "name": "my-project",
        "version": "1.0.0",
        "description": "My project description",
        "scripts": {
            "test": "jest"
        },
        "devDependencies": {
            "jest": "^27.4.7",
            "@types/jest": "^27.0.4",
            "ts-jest": "^27.0.5"
        }
    }
    `;

    fs.writeFileSync(packageJsonPath, packageJsonContent);
    vscode.window.showInformationMessage('package.json created successfully.');
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {

	console.log('Extension "exttest" is now active!');

	setWorkingDirectory();
	createJestConfig();

	let disposable = vscode.commands.registerCommand('exttest.generateTests', generateTests);
	let disposable2 = vscode.commands.registerCommand('exttest.runTests', runTests);

}

export function deactivate() {}
