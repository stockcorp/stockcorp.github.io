const canvas = document.getElementById('xiangqi-board');
const ctx = canvas.getContext('2d');
const gridWidth = 9;
const gridHeight = 10;
const cellWidth = canvas.width / gridWidth;
const cellHeight = canvas.height / gridHeight;
let board = [];
let currentPlayer = 'red'; // 'red' (玩家), 'black' (AI)
let redScore = 16;
let blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null; // 選中的棋子位置 {x, y}
let gameOver = false; // 遊戲結束標誌

// 初始化棋盤
function initializeBoard() {
    board = Array(gridHeight).fill().map(() => Array(gridWidth).fill(''));
    // 紅方 (玩家)
    board[0] = ['rc', 'rn', 'rb', 'ra', 'rk', 'ra', 'rb', 'rn', 'rc'];
    board[2][1] = 'rp'; board[2][7] = 'rp';
    board[3][0] = 'rs'; board[3][2] = 'rs'; board[3][4] = 'rs'; board[3][6] = 'rs'; board[3][8] = 'rs';
    // 黑方 (AI)
    board[9] = ['bc', 'bn', 'bb', 'ba', 'bk', 'ba', 'bb', 'bn', 'bc'];
    board[7][1] = 'bp'; board[7][7] = 'bp';
    board[6][0] = 'bs'; board[6][2] = 'bs'; board[6][4] = 'bs'; board[6][6] = 'bs'; board[6][8] = 'bs';
    redScore = 16;
    blackScore = 16;
    gameOver = false;
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製格線
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x < gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth, 0);
        ctx.lineTo(x * cellWidth, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellHeight);
        ctx.lineTo(canvas.width, y * cellHeight);
        ctx.stroke();
    }

    // 繪製楚河漢界
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 4 * cellHeight, canvas.width, cellHeight);
    ctx.fillStyle = '#333';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('楚河          漢界', canvas.width / 2, 4.5 * cellHeight);

    // 繪製宮格斜線
    ctx.beginPath();
    ctx.moveTo(3 * cellWidth, 0);
    ctx.lineTo(5 * cellWidth, 2 * cellHeight);
    ctx.moveTo(5 * cellWidth, 0);
    ctx.lineTo(3 * cellWidth, 2 * cellHeight);
    ctx.moveTo(3 * cellWidth, 7 * cellHeight);
    ctx.lineTo(5 * cellWidth, 9 * cellHeight);
    ctx.moveTo(5 * cellWidth, 7 * cellHeight);
    ctx.lineTo(3 * cellWidth, 9 * cellHeight);
    ctx.stroke();

    // 繪製棋子
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (board[y][x]) {
                drawPiece(x, y, board[y][x], 1);
            }
        }
    }

    // 高亮選中的棋子
    if (selectedPiece) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x * cellWidth, selectedPiece.y * cellHeight, cellWidth, cellHeight);
    }
}

// 繪製棋子（帶透明度）
function drawPiece(x, y, piece, opacity = 1) {
    ctx.save();
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece.startsWith('r') ? '#e74c3c' : '#000';
    ctx.globalAlpha = opacity;
    const symbols = {
        'c': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'p': '炮', 's': '兵'
    };
    ctx.fillText(symbols[piece[1]], x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2);
    ctx.restore();
}

// 動畫移動棋子
function animatePiece(fromX, fromY, toX, toY, piece, callback) {
    let opacity = 0;
    const duration = 300;
    const startTime = performance.now();

    function step(timestamp) {
        const elapsed = timestamp - startTime;
        opacity = Math.min(elapsed / duration, 1);
        drawBoard();
        drawPiece(toX, toY, piece, opacity);

        if (elapsed < duration) {
            requestAnimationFrame(step);
        } else if (callback) {
            callback();
        }
    }

    if (stoneSound) {
        stoneSound.currentTime = 0;
        stoneSound.play().catch(error => console.error('音效播放失敗:', error));
    }
    requestAnimationFrame(step);
}

// 更新計分板
function updateScoreboard() {
    redScore = board.flat().filter(cell => cell.startsWith('r')).length;
    blackScore = board.flat().filter(cell => cell.startsWith('b')).length;
    document.getElementById('red-score').textContent = redScore;
    document.getElementById('black-score').textContent = blackScore;
}

// 檢查遊戲是否結束
function checkGameOver() {
    let redKing = false;
    let blackKing = false;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (board[y][x] === 'rk') redKing = true;
            if (board[y][x] === 'bk') blackKing = true;
        }
    }
    if (!redKing) {
        gameOver = true;
        alert('黑方勝！');
    } else if (!blackKing) {
        gameOver = true;
        alert('紅方勝！');
    }
    return gameOver;
}

// 簡單的移動合法性檢查（僅示例）
function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('r')) return false;
    return true; // 簡化版，實際需檢查象棋規則
}

// AI 移動（隨機選擇黑方移動）
function aiMove() {
    if (currentPlayer === 'black' && !gameOver) {
        let blackPieces = [];
        let emptyOrRedCells = [];

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (board[y][x] && board[y][x].startsWith('b')) {
                    blackPieces.push({ x, y });
                }
                if (!board[y][x] || board[y][x].startsWith('r')) {
                    emptyOrRedCells.push({ x, y });
                }
            }
        }

        if (blackPieces.length > 0 && emptyOrRedCells.length > 0) {
            const from = blackPieces[Math.floor(Math.random() * blackPieces.length)];
            const to = emptyOrRedCells[Math.floor(Math.random() * emptyOrRedCells.length)];
            const piece = board[from.y][from.x];
            const target = board[to.y][to.x];

            board[from.y][from.x] = '';
            board[to.y][to.x] = piece;

            animatePiece(from.x, from.y, to.x, to.y, piece, () => {
                if (target) updateScoreboard();
                if (!checkGameOver()) {
                    currentPlayer = 'red';
                    document.getElementById('current-player').textContent = '紅方';
                    drawBoard();
                }
            });
        }
    }
}

// 玩家移動後觸發 AI
canvas.addEventListener('click', (e) => {
    if (gameOver) return; // 遊戲結束後禁用點擊

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellWidth);
    const y = Math.floor((e.clientY - rect.top) / cellHeight);

    if (currentPlayer !== 'red') return;

    if (!selectedPiece && board[y][x] && board[y][x].startsWith('r')) {
        selectedPiece = { x, y };
        drawBoard();
    } else if (selectedPiece) {
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            const target = board[y][x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = piece;

            animatePiece(selectedPiece.x, selectedPiece.y, x, y, piece, () => {
                if (target) updateScoreboard();
                selectedPiece = null;
                if (!checkGameOver()) {
                    currentPlayer = 'black';
                    document.getElementById('current-player').textContent = '黑方';
                    drawBoard();
                    setTimeout(aiMove, 500);
                }
            });
        } else {
            selectedPiece = null;
            drawBoard();
        }
    }
});

// 重置遊戲
document.getElementById('reset-btn').addEventListener('click', () => {
    initializeBoard();
    currentPlayer = 'red';
    document.getElementById('current-player').textContent = '紅方';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
});

// 初始化
initializeBoard();
drawBoard();
updateScoreboard();
