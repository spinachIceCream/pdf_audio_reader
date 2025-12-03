// State
let pdfDoc = null;
let sentences = [];
let currentSentenceIndex = 0;
let isPlaying = false;
let speechRate = 1.0;
let synth = window.speechSynthesis;
let currentUtterance = null;
let voices = [];
let selectedVoice = null;
let savedPapers = [];

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const playerInterface = document.getElementById('player-interface');
const textDisplay = document.getElementById('text-display');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const playPauseBtn = document.getElementById('play-pause');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const prevBtn = document.getElementById('prev-sentence');
const nextBtn = document.getElementById('next-sentence');
const speedSelect = document.getElementById('speed-select');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const apiKeyInput = document.getElementById('api-key-input');
const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models-btn');
const voiceSelect = document.getElementById('voice-select');
const savedPapersList = document.getElementById('saved-papers-list');

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
uploadPlaceholder.addEventListener('click', () => fileInput.click());
refreshModelsBtn.addEventListener('click', fetchModels);

// Voice Selection
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}
populateVoiceList();

voiceSelect.addEventListener('change', () => {
    const selectedOption = voiceSelect.selectedOptions[0].getAttribute('data-name');
    selectedVoice = voices.find(v => v.name === selectedOption);
    if (isPlaying) {
        stopSpeaking();
        speakSentence(currentSentenceIndex);
    }
});

// Drag and Drop
uploadPlaceholder.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadPlaceholder.style.borderColor = 'var(--primary-color)';
    uploadPlaceholder.style.backgroundColor = '#eff6ff';
});

uploadPlaceholder.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadPlaceholder.style.borderColor = 'var(--border-color)';
    uploadPlaceholder.style.backgroundColor = 'var(--surface-color)';
});

uploadPlaceholder.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadPlaceholder.style.borderColor = 'var(--border-color)';
    uploadPlaceholder.style.backgroundColor = 'var(--surface-color)';
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

playPauseBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', playPrevious);
nextBtn.addEventListener('click', playNext);

speedSelect.addEventListener('change', (e) => {
    speechRate = parseFloat(e.target.value);
    if (isPlaying) {
        stopSpeaking();
        speakSentence(currentSentenceIndex);
    }
});

progressBar.addEventListener('input', (e) => {
    const newIndex = parseInt(e.target.value);
    currentSentenceIndex = newIndex;
    updateDisplay();
    if (isPlaying) {
        stopSpeaking();
        speakSentence(currentSentenceIndex);
    }
});

// Init
loadSavedPapers();

// Main Functions

function populateVoiceList() {
    voices = synth.getVoices();
    voiceSelect.innerHTML = '';

    // Filter for English voices primarily, or show all
    // Let's show all but sort English to top
    voices.sort((a, b) => {
        const aLang = a.lang.toLowerCase();
        const bLang = b.lang.toLowerCase();
        if (aLang.startsWith('en') && !bLang.startsWith('en')) return -1;
        if (!aLang.startsWith('en') && bLang.startsWith('en')) return 1;
        return a.name.localeCompare(b.name);
    });

    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.setAttribute('data-name', voice.name);
        if (voice.default) {
            option.textContent += ' -- DEFAULT';
        }
        voiceSelect.appendChild(option);
    });

    if (voices.length > 0 && !selectedVoice) {
        // Try to find Clara Canada first
        const clara = voices.find(v => v.name.toLowerCase().includes('clara') && v.name.toLowerCase().includes('canada'));

        selectedVoice = clara || voices.find(v => v.default) || voices[0];

        // Match the select value to the option text
        const defaultOption = Array.from(voiceSelect.options).find(opt => opt.getAttribute('data-name') === selectedVoice.name);
        if (defaultOption) defaultOption.selected = true;
    }
}

async function fetchModels() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter an API Key first.');
        return;
    }

    // Animate button
    const originalIcon = refreshModelsBtn.innerHTML;
    refreshModelsBtn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px;"></div>';
    refreshModelsBtn.disabled = true;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || response.statusText);
        }
        const data = await response.json();

        // Filter for generateContent supported models
        const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));

        // Populate Select
        modelSelect.innerHTML = '';

        // Priority models to show at top
        const priority = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];

        // Sort models: priority first, then alphabetical
        models.sort((a, b) => {
            const nameA = a.name.replace('models/', '');
            const nameB = b.name.replace('models/', '');
            const idxA = priority.indexOf(nameA);
            const idxB = priority.indexOf(nameB);

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return nameA.localeCompare(nameB);
        });

        models.forEach(model => {
            const name = model.name.replace('models/', '');
            const option = document.createElement('option');
            option.value = name;
            option.textContent = model.displayName || name;
            if (name === 'gemini-2.0-flash') option.selected = true;
            modelSelect.appendChild(option);
        });

        // Ensure default is selected if available
        if (modelSelect.value !== 'gemini-2.0-flash' && Array.from(modelSelect.options).some(o => o.value === 'gemini-2.0-flash')) {
            modelSelect.value = 'gemini-2.0-flash';
        }

    } catch (error) {
        alert('Error fetching models: ' + error.message);
    } finally {
        refreshModelsBtn.innerHTML = originalIcon;
        refreshModelsBtn.disabled = false;
    }
}

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please upload a valid PDF file.');
        return;
    }

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter a valid Gemini API Key to use the AI extraction feature.');
        return;
    }

    showLoading(true, "Extracting text from PDF...");

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        pdfDoc = await loadingTask.promise;

        const rawText = await extractText(pdfDoc);

        if (!rawText || rawText.length < 50) {
            alert('No readable text found in this PDF.');
            showLoading(false);
            return;
        }

        showLoading(true, "AI is analyzing and cleaning text...");
        const result = await callGeminiAPI(rawText, apiKey);

        if (!result || !result.content) {
            throw new Error("Failed to get valid response from AI.");
        }

        const cleanText = result.content;
        const title = result.title || file.name.replace('.pdf', '');

        // Save and Load
        const paperId = savePaper(title, cleanText);
        loadPaper(paperId);

    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function extractText(pdf) {
    let fullText = "";
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Simple extraction, let AI handle the cleanup
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n\n";
    }
    return fullText;
}

async function callGeminiAPI(text, apiKey) {
    const selectedModel = modelSelect.value || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    const prompt = `
    You are an expert academic editor. Your task is to extract the MAIN TEXT content from the following academic paper raw text.
    
    Rules:
    1. Remove all references, bibliographies, and citations.
    2. Remove all headers, footers, page numbers, and running titles.
    3. Remove all figure captions, table captions, and data tables.
    4. Remove author names, affiliations, emails, and acknowledgments.
    5. Keep the Abstract, Introduction, Methods, Results, Discussion, and Conclusion.
    6. Return a JSON object with the following structure:
       {
         "title": "The Title of the Paper",
         "content": "The clean, readable text..."
       }
    7. Do not include any markdown formatting like **bold** or # headers unless necessary for structure, but prefer plain text paragraphs.
    8. Do not add any conversational filler.
    
    Raw Text:
    ${text.substring(0, 800000)} 
    `;
    // Truncate to ~800k chars (safe for Gemini 2.0 Flash 1M context)

    const payload = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API request failed');
        }

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;

        // Clean up markdown code blocks if present
        const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.warn("Failed to parse JSON, falling back to raw text", e);
            // Fallback if model refuses to return JSON
            return {
                title: "Extracted Paper",
                content: textResponse
            };
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}

function splitIntoSentences(text) {
    // Clean up whitespace first
    text = text.replace(/\s+/g, ' ').trim();

    if (window.Intl && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
        const segments = segmenter.segment(text);
        return Array.from(segments).map(s => s.segment.trim()).filter(s => s.length > 0);
    } else {
        return text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g).map(s => s.trim()).filter(s => s.length > 0);
    }
}

function renderText() {
    textDisplay.innerHTML = sentences.map((sentence, index) => {
        return `<span id="sent-${index}" class="sentence" onclick="jumpTo(${index})">${sentence} </span>`;
    }).join('');
}

function jumpTo(index) {
    currentSentenceIndex = index;
    updateDisplay();
    if (isPlaying) {
        stopSpeaking();
        speakSentence(currentSentenceIndex);
    }
}

function updateDisplay() {
    // Highlight current sentence
    document.querySelectorAll('.sentence').forEach(el => el.classList.remove('highlight'));
    const currentEl = document.getElementById(`sent-${currentSentenceIndex}`);
    if (currentEl) {
        currentEl.classList.add('highlight');
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Update progress bar
    progressBar.value = currentSentenceIndex;
    currentTimeEl.textContent = formatTime(currentSentenceIndex);
}

function updateProgressBar() {
    progressBar.max = sentences.length - 1;
    totalTimeEl.textContent = sentences.length + " sent";
    currentTimeEl.textContent = (currentSentenceIndex + 1) + " / ";
}

function formatTime(val) {
    return val;
}

// Playback Logic

function togglePlay() {
    if (isPlaying) {
        pause();
    } else {
        play();
    }
}

function play() {
    isPlaying = true;
    updatePlayIcon();

    if (synth.paused) {
        synth.resume();
    } else {
        speakSentence(currentSentenceIndex);
    }
}

function pause() {
    isPlaying = false;
    updatePlayIcon();
    synth.cancel();
}

function stopSpeaking() {
    synth.cancel();
}

function speakSentence(index) {
    if (index >= sentences.length) {
        isPlaying = false;
        updatePlayIcon();
        return;
    }

    const text = sentences[index];
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = speechRate;
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
    }

    currentUtterance.onend = () => {
        if (isPlaying) {
            currentSentenceIndex++;
            if (currentSentenceIndex < sentences.length) {
                updateDisplay();
                updateProgressBar();
                speakSentence(currentSentenceIndex);
            } else {
                isPlaying = false;
                updatePlayIcon();
            }
        }
    };

    currentUtterance.onerror = (e) => {
        console.error('Speech error:', e);
        isPlaying = false;
        updatePlayIcon();
    };

    updateDisplay();
    updateProgressBar();
    synth.speak(currentUtterance);
}

function playNext() {
    if (currentSentenceIndex < sentences.length - 1) {
        currentSentenceIndex++;
        if (isPlaying) {
            stopSpeaking();
            speakSentence(currentSentenceIndex);
        } else {
            updateDisplay();
            updateProgressBar();
        }
    }
}

function playPrevious() {
    if (currentSentenceIndex > 0) {
        currentSentenceIndex--;
        if (isPlaying) {
            stopSpeaking();
            speakSentence(currentSentenceIndex);
        } else {
            updateDisplay();
            updateProgressBar();
        }
    }
}

function updatePlayIcon() {
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

function showLoading(show, text = "Processing...") {
    if (show) {
        loadingText.textContent = text;
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// Saved Papers Logic

function savePaper(title, content) {
    const id = Date.now().toString();
    const paper = { id, title, content, date: new Date().toISOString() };
    savedPapers.push(paper);
    localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
    renderSavedPapers();
    return id;
}

function loadSavedPapers() {
    const stored = localStorage.getItem('savedPapers');
    if (stored) {
        try {
            savedPapers = JSON.parse(stored);
            renderSavedPapers();
        } catch (e) {
            console.error("Failed to load saved papers", e);
        }
    }
}

function renderSavedPapers() {
    savedPapersList.innerHTML = '';
    savedPapers.forEach(paper => {
        const li = document.createElement('li');
        li.className = 'section-item'; // Reusing existing class for style
        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;" title="${paper.title}">${paper.title}</span>
                <div style="display: flex; gap: 4px;">
                    <button class="edit-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px;" title="Rename">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="delete-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px;" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;

        li.onclick = (e) => {
            // Prevent triggering if buttons clicked
            if (e.target.closest('.delete-btn') || e.target.closest('.edit-btn')) return;
            loadPaper(paper.id);
        };

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deletePaper(paper.id);
        };

        const editBtn = li.querySelector('.edit-btn');
        editBtn.onclick = (e) => {
            e.stopPropagation();
            renamePaper(paper.id);
        };

        savedPapersList.appendChild(li);
    });
}

function renamePaper(id) {
    const paper = savedPapers.find(p => p.id === id);
    if (!paper) return;

    const newTitle = prompt("Enter new name for this paper:", paper.title);
    if (newTitle && newTitle.trim() !== "") {
        paper.title = newTitle.trim();
        localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
        renderSavedPapers();
    }
}

function deletePaper(id) {
    if (confirm('Are you sure you want to delete this paper?')) {
        savedPapers = savedPapers.filter(p => p.id !== id);
        localStorage.setItem('savedPapers', JSON.stringify(savedPapers));
        renderSavedPapers();
    }
}

function loadPaper(id) {
    const paper = savedPapers.find(p => p.id === id);
    if (!paper) return;

    sentences = splitIntoSentences(paper.content);

    // Reset State
    currentSentenceIndex = 0;
    isPlaying = false;
    updatePlayIcon();

    // Setup UI
    uploadPlaceholder.classList.add('hidden');
    playerInterface.classList.remove('hidden');

    renderText();
    updateProgressBar();

    // Highlight sidebar item
    document.querySelectorAll('#saved-papers-list .section-item').forEach(el => el.classList.remove('active'));
    // Finding the element is a bit tricky without ID, but we can re-render or just leave it.
    // Let's re-render to set active state if we want, but for now simple is fine.
}
