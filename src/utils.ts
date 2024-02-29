import * as vscode from 'vscode';
import * as fs from 'fs';

export function folderExists(path: string): boolean {
    try {
        return fs.statSync(path).isDirectory();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // ENOENT: no such file or directory
            return false;
        } else {
            // Other error, e.g., permission denied
            throw error;
        }
    }
}

export function fileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // ENOENT: no such file or directory
            return false;
        } else {
            // Other error, e.g., permission denied
            throw error;
        }
    }
}

export function createFolder(folderPath: string): void {
    try {
        fs.mkdirSync(folderPath);
        console.log(`Folder created at ${folderPath}`);
    } catch (error) {
        console.error(`Error creating folder: ${error}`);
    }
}

export function createFile(filePath: string, fileContent: string = ''): void {
    try {
        fs.writeFileSync(filePath, fileContent);
        console.log(`File created at ${filePath}`);
    } catch (error) {
        console.error(`Error creating file: ${error}`);
    }
}

export function wipeFile(filePath: string): void {
    try {
        fs.writeFileSync(filePath, ''); // Write an empty string to the file
        console.log(`File wiped successfully: ${filePath}`);
    } catch (error) {
        console.error(`Error wiping file: ${error}`);
    }
}

export function getActiveFileName(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        // Get the URI of the currently open file
        const uri = editor.document.uri;
        // Get the base name (name without path) of the file
        const fileName = vscode.workspace.asRelativePath(uri);
        // Remove the file extension
        const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
        return fileNameWithoutExtension;
    } else {
        // No file is currently open
        return undefined;
    }
}