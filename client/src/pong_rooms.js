
// Emulate
let gameRooms = [
  { id: 1, name: "Room 1", players: 1, maxPlayers: 2 },
  { id: 2, name: "Room 2", players: 2, maxPlayers: 2 },
];

// Affichage des rooms dans la liste
export function renderGamesList() {
  const list = document.getElementById('games-list');
  if (!list) return;
  list.innerHTML = gameRooms.map(room =>
    `<div class="flex justify-between items-center bg-indigo-50 px-4 py-2 rounded-lg">
      <span>${room.name} - ${room.players}/${room.maxPlayers} players</span>
      <button data-roomid="${room.id}" class="join-game-btn px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">Join</button>
    </div>`
  ).join('');
  // Ajouter event listener sur tous les boutons join
  document.querySelectorAll('.join-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const roomId = parseInt(btn.getAttribute('data-roomid'));
      openPongModal(roomId);
    });
  });
}

// Modal simple pour afficher le jeu Pong
function openPongModal(roomId) {
  // Création du backdrop et du container modal
  const modal = document.createElement('div');
  modal.id = "pong-modal";
  modal.className = "fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50";
  modal.innerHTML = `
    <div class="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center"
         style="height:90vh;">
      <button id="closePongModal" class="absolute top-4 right-4 text-xl font-bold px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-full">&times;</button>
      <h2 class="text-2xl font-bold text-indigo-600 mb-4">Pong - Room ${roomId}</h2>
      <canvas id="pong-canvas" width="800" height="500" class="bg-black rounded shadow-lg"></canvas>
    </div>
  `;
  document.body.appendChild(modal);

  // Close modal
  document.getElementById('closePongModal').onclick = () => {
    modal.remove();
  };

  // Initialiser Pong DUMMY
  drawDummyPong();
}

// Dummy Pong (à remplacer plus tard par le vrai jeu !)
function drawDummyPong() {
  const canvas = document.getElementById('pong-canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "36px monospace";
  ctx.fillText("PONG GAME HERE", 220, 250);
}

// Event pour bouton "Create game"
export function initCreateGameBtn() {
  const btn = document.getElementById('newGameBtn');
  if (btn) {
    btn.onclick = () => {
      // Pour l'instant, on ajoute une room fictive
      const newId = gameRooms.length + 1;
      gameRooms.push({ id: newId, name: `Room ${newId}`, players: 1, maxPlayers: 2 });
      renderGamesList();
    };
  }
}
