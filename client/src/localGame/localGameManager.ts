import { state } from "../api";
import { showNotification } from "../notifications";
import { showPongMenu } from "../pong_rooms";

const uiOverlay = document.getElementById('ui-overlay');

function createLocalGameConfigViewHTML(): string
{
    return `
        <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div class="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 text-white w-full max-w-md flex flex-col items-center space-y-6 animate-fade-in">
                <h2 class="text-4xl font-bold text-teal-300 font-['Orbitron']">Local Game Setup</h2>
                
                <div class="w-full space-y-4">
                    <div class="w-full">
                        <label for="ball-speed-slider" class="flex justify-between items-center text-lg">
                            <span>Ball Speed</span>
                            <span id="ball-speed-value" class="font-bold text-teal-300">50</span>
                        </label>
                        <input id="ball-speed-slider" type="range" min="10" max="100" value="50" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500">
                    </div>

                    <div class="w-full">
                        <label for="paddle-speed-slider" class="flex justify-between items-center text-lg">
                            <span>Paddle Speed</span>
                            <span id="paddle-speed-value" class="font-bold text-teal-300">50</span>
                        </label>
                        <input id="paddle-speed-slider" type="range" min="10" max="100" value="50" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500">
                    </div>

                    <div class="w-full">
                        <label for="winning-score-slider" class="flex justify-between items-center text-lg">
                            <span>Winning Score</span>
                            <span id="winning-score-value" class="font-bold text-teal-300">5</span>
                        </label>
                        <input id="winning-score-slider" type="range" min="1" max="15" value="5" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500">
                    </div>
                </div>

                <button id="start-local-game-btn" class="w-full bg-teal-500 hover:bg-teal-400 text-gray-900 font-bold py-3 px-4 rounded-lg text-xl transition duration-300 transform hover:scale-105">
                    Start Game
                </button>
                <button id="back-to-main-menu-btn" class="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    Back
                </button>
            </div>
        </div>
    `;
}

export function showLocalGameConfigView()
{
    const uiOverlay = document.getElementById('ui-overlay');
    if (!uiOverlay)
    {
        return;
    }

    uiOverlay.innerHTML = createLocalGameConfigViewHTML();
    uiOverlay.classList.remove('hidden');

    const ballSpeedSlider = document.getElementById('ball-speed-slider') as HTMLInputElement;
    const ballSpeedValue = document.getElementById('ball-speed-value');
    const paddleSpeedSlider = document.getElementById('paddle-speed-slider') as HTMLInputElement;
    const paddleSpeedValue = document.getElementById('paddle-speed-value');
    const winningScoreSlider = document.getElementById('winning-score-slider') as HTMLInputElement;
    const winningScoreValue = document.getElementById('winning-score-value');

    ballSpeedSlider.addEventListener('input', () =>
    {
        if (ballSpeedValue)
        {
            ballSpeedValue.textContent = ballSpeedSlider.value;
        }
    });
    paddleSpeedSlider.addEventListener('input', () =>
    {
        if (paddleSpeedValue)
        {
            paddleSpeedValue.textContent = paddleSpeedSlider.value;
        }
    });
    winningScoreSlider.addEventListener('input', () =>
    {
        if (winningScoreValue)
        {
            winningScoreValue.textContent = winningScoreSlider.value;
        }
    });

    const cleanupView = () =>
    {
        uiOverlay.innerHTML = '';
        uiOverlay.classList.add('hidden');
    };

    document.getElementById('start-local-game-btn')?.addEventListener('click', () =>
    {
        showNotification({ message: 'clic clic clic', duration: 3000 });
        cleanupView();
        showPongMenu();
    });

    document.getElementById('back-to-main-menu-btn')?.addEventListener('click', () =>
    {
        cleanupView();
        state.canvasViewState = 'mainMenu';
        showPongMenu();
    });
}