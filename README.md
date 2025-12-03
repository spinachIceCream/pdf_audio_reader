# ScholarVoice: AI-Powered Academic Paper Reader

ScholarVoice is a web application that converts academic PDF papers into clean, read-aloud audio. It uses Google's Gemini AI to extract the main text from PDFs (filtering out references, headers, and figures) and uses the browser's Text-to-Speech engine for playback.

## Features
- **Smart Extraction**: Uses Gemini AI to extract only the relevant content from academic papers.
- **Audio Playback**: Listen to your papers with sentence-by-sentence navigation.
- **Speed Control**: Adjust reading speed from 0.75x to 4.0x.
- **Voice Selection**: Choose from available browser voices.
- **Saved Papers**: Automatically saves processed papers to your browser's local storage for offline access.

## How to Use

1.  **Get an API Key**: You need a Google Gemini API key to use the text extraction feature. You can get a free key at [Google AI Studio](https://aistudio.google.com/).
2.  **Open the App**: Open `index.html` in your web browser.
3.  **Enter API Key**: Paste your API key into the input field at the top right.
4.  **Upload PDF**: Click "Upload PDF" or drag and drop a file into the upload zone.
5.  **Listen**: Once processed, use the player controls to listen to the paper.

## Setup for Development

This is a static web application consisting of HTML, CSS, and JavaScript. No build process is required.

1.  Clone the repository.
2.  Open `index.html` in your browser.

## Privacy Note

Your API key is stored only in your browser's memory while you use the app. It is not sent to any server other than Google's Generative Language API for the purpose of processing your text.
