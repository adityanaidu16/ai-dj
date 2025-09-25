export function getHTMLContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI DJ - Your Personal Music Assistant</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }

        .chat-container {
            height: 500px;
            overflow-y: auto;
            padding: 20px;
            background: #f7f8fc;
        }

        .message {
            margin-bottom: 20px;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .message.user {
            text-align: right;
        }

        .message.ai {
            text-align: left;
        }

        .message-bubble {
            display: inline-block;
            max-width: 70%;
            padding: 12px 18px;
            border-radius: 18px;
            word-wrap: break-word;
        }

        .message.user .message-bubble {
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
        }

        .message.ai .message-bubble {
            background: white;
            color: #333;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .track-recommendation {
            background: white;
            border-radius: 10px;
            padding: 15px;
            margin: 10px 0;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .track-image {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            object-fit: cover;
        }

        .track-info {
            flex: 1;
        }

        .track-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }

        .track-artist {
            color: #666;
            font-size: 0.9em;
        }

        .input-container {
            padding: 20px;
            background: white;
            border-top: 1px solid #e0e0e0;
        }

        .input-wrapper {
            display: flex;
            gap: 10px;
        }

        #messageInput {
            flex: 1;
            padding: 12px 20px;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        #messageInput:focus {
            outline: none;
            border-color: #ff6b35;
        }

        #sendButton {
            padding: 12px 30px;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            transition: transform 0.2s;
        }

        #sendButton:hover {
            transform: scale(1.05);
        }

        #sendButton:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .typing-indicator {
            display: none;
            padding: 15px;
            text-align: left;
        }

        .typing-indicator.active {
            display: block;
        }

        .typing-dots {
            display: inline-block;
            background: white;
            padding: 10px 15px;
            border-radius: 18px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .typing-dots span {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #999;
            margin: 0 2px;
            animation: typing 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% {
                opacity: 0.3;
                transform: translateY(0);
            }
            30% {
                opacity: 1;
                transform: translateY(-10px);
            }
        }

        .spotify-auth {
            text-align: center;
            padding: 20px;
            background: #f0f4ff;
            margin: 20px;
            border-radius: 10px;
        }

        .spotify-auth button {
            background: #1DB954;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
        }

        .spotify-auth button:hover {
            background: #1ed760;
        }

        .question-container {
            background: white;
            border-radius: 10px;
            padding: 15px;
            margin: 10px 0;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 70%;
            display: inline-block;
        }

        .question-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }

        .option-button {
            display: block;
            width: 100%;
            text-align: left;
            padding: 10px 15px;
            margin: 5px 0;
            background: #f0f4ff;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .option-button:hover {
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            border-color: #ff6b35;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 AI DJ</h1>
            <p>Your Personal Music Assistant powered by AI</p>
        </div>

        <div id="spotifyAuth" class="spotify-auth" style="display: none;">
            <p>Connect your Spotify account to enable playlist creation and music control</p>
            <button onclick="connectSpotify()">Connect Spotify</button>
        </div>

        <div class="chat-container" id="chatContainer">
            <div class="message ai">
                <div class="message-bubble">
                    👋 Hey! I'm your AI DJ. I can help you discover music, create playlists, and find the perfect tracks for any mood. What kind of music are you in the mood for?
                </div>
            </div>
        </div>

        <div class="typing-indicator" id="typingIndicator">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>

        <div class="input-container">
            <div class="input-wrapper">
                <input
                    type="text"
                    id="messageInput"
                    placeholder="Ask me anything about music..."
                    onkeypress="handleKeyPress(event)"
                >
                <button id="sendButton" onclick="sendMessage()">Send</button>
            </div>
        </div>
    </div>

    <script>
        let sessionId = localStorage.getItem('ai-dj-session') || generateSessionId();
        localStorage.setItem('ai-dj-session', sessionId);

        function generateSessionId() {
            return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                sendMessage();
            }
        }

        // Remove old sendMessage function as we have a new one below

        function appendMessage(message, sender) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${sender}\`;

            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            bubbleDiv.textContent = message;

            messageDiv.appendChild(bubbleDiv);
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function appendRecommendations(tracks) {
            const chatContainer = document.getElementById('chatContainer');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai';

            const recommendationsDiv = document.createElement('div');
            recommendationsDiv.style.maxWidth = '70%';
            recommendationsDiv.style.display = 'inline-block';

            tracks.forEach(track => {
                const trackDiv = document.createElement('div');
                trackDiv.className = 'track-recommendation';

                if (track.album.images && track.album.images.length > 0) {
                    const img = document.createElement('img');
                    img.className = 'track-image';
                    img.src = track.album.images[0].url;
                    img.alt = track.album.name;
                    trackDiv.appendChild(img);
                }

                const infoDiv = document.createElement('div');
                infoDiv.className = 'track-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'track-name';
                nameDiv.textContent = track.name;

                const artistDiv = document.createElement('div');
                artistDiv.className = 'track-artist';
                artistDiv.textContent = track.artists.map(a => a.name).join(', ');

                infoDiv.appendChild(nameDiv);
                infoDiv.appendChild(artistDiv);
                trackDiv.appendChild(infoDiv);

                recommendationsDiv.appendChild(trackDiv);
            });

            messageDiv.appendChild(recommendationsDiv);
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function showTypingIndicator() {
            document.getElementById('typingIndicator').classList.add('active');
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function hideTypingIndicator() {
            document.getElementById('typingIndicator').classList.remove('active');
        }

        let currentQuestionIndex = 0;
        let allQuestions = [];
        let userAnswers = {};

        function appendQuestions(message, questions) {
            const chatContainer = document.getElementById('chatContainer');

            console.log('Questions received:', questions);

            // Store questions for sequential display
            allQuestions = Array.isArray(questions) ? questions : [];
            currentQuestionIndex = 0;
            userAnswers = {};

            // Add the initial message
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ai';
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'message-bubble';
            bubbleDiv.textContent = message;
            messageDiv.appendChild(bubbleDiv);
            chatContainer.appendChild(messageDiv);

            // Show first question only
            if (allQuestions.length > 0) {
                showNextQuestion();
            }
        }

        function showNextQuestion() {
            if (currentQuestionIndex >= allQuestions.length) {
                // All questions answered, send the complete response
                const answersText = Object.entries(userAnswers)
                    .map(([qId, answer]) => \`\${qId}: \${answer}\`)
                    .join(', ');

                const finalMessage = \`Based on my preferences: \${answersText}. Now give me great recommendations!\`;
                sendMessage(finalMessage);
                return;
            }

            const q = allQuestions[currentQuestionIndex];
            const chatContainer = document.getElementById('chatContainer');

            const questionDiv = document.createElement('div');
            questionDiv.className = 'message ai';

            const containerDiv = document.createElement('div');
            containerDiv.className = 'question-container';
            containerDiv.id = \`question-\${currentQuestionIndex}\`;

            const titleDiv = document.createElement('div');
            titleDiv.className = 'question-title';
            titleDiv.textContent = q.question || 'Select an option:';
            containerDiv.appendChild(titleDiv);

            const options = Array.isArray(q.options) ? q.options : [];

            options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'option-button';
                button.textContent = typeof option === 'string' ? option : JSON.stringify(option);
                button.onclick = () => {
                    // Store answer
                    userAnswers[q.id] = option;

                    // Show user's choice
                    appendMessage(\`\${option}\`, 'user');

                    // Disable current question's buttons
                    containerDiv.querySelectorAll('.option-button').forEach(btn => {
                        btn.disabled = true;
                        btn.style.opacity = '0.5';
                    });

                    // Move to next question
                    currentQuestionIndex++;
                    setTimeout(showNextQuestion, 500);
                };
                containerDiv.appendChild(button);
            });

            questionDiv.appendChild(containerDiv);
            chatContainer.appendChild(questionDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function sendMessage(customMessage) {
            const input = document.getElementById('messageInput');
            const message = customMessage || input.value.trim();

            if (!message) return;

            if (!customMessage) {
                appendMessage(message, 'user');
                input.value = '';
            }

            input.disabled = true;
            document.getElementById('sendButton').disabled = true;

            showTypingIndicator();

            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: sessionId
                })
            }).then(async response => {
                const data = await response.json();
                hideTypingIndicator();

                if (data.metadata && data.metadata.questions) {
                    appendQuestions(data.message, data.metadata.questions);
                } else {
                    appendMessage(data.message, 'ai');
                    if (data.recommendations && data.recommendations.length > 0) {
                        appendRecommendations(data.recommendations);
                    }
                }
            }).catch(error => {
                hideTypingIndicator();
                appendMessage('Sorry, I encountered an error. Please try again.', 'ai');
            }).finally(() => {
                input.disabled = false;
                document.getElementById('sendButton').disabled = false;
                input.focus();
            });
        }

        function connectSpotify() {
            const clientId = prompt('Enter your Spotify Client ID:');
            if (clientId) {
                const redirectUri = encodeURIComponent(window.location.origin + '/spotify-callback');
                const scope = encodeURIComponent('playlist-modify-private playlist-modify-public user-read-private');
                const authUrl = \`https://accounts.spotify.com/authorize?client_id=\${clientId}&response_type=token&redirect_uri=\${redirectUri}&scope=\${scope}\`;
                window.location.href = authUrl;
            }
        }

        // Check for Spotify callback
        if (window.location.hash) {
            const params = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = params.get('access_token');
            if (accessToken) {
                localStorage.setItem('spotify-token', accessToken);
                window.location.hash = '';
                alert('Spotify connected successfully!');
            }
        }
    </script>
</body>
</html>`;
}