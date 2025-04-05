const canvas = document.getElementById('chess-board');
const ctx = canvas.getContext('2d');
const gridSize = 8;
const cellSize = canvas.width / gridSize;
let board = [];
let currentPlayer = 'white'; // 'white' (玩家), 'black' (AI)
let whiteScore = 16;
let blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null; // 選中的棋子位置 {x, y}

// 初始化棋盤
function initializeBoard() {
    board = [
        ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'], // 黑棋後排
        ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'], // 黑棋兵
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'], // 白棋兵
        ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']  // 白棋後排
    ];
    whiteScore = 16;
    blackScore = 16;
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製格子
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#f0d9b5' : '#b58863';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
    }

    // 繪製棋子
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x]) {
                drawPiece(x, y, board[y][x], 1);
            }
        }
    }

    // 高亮選中的棋子
    if (selectedPiece) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x * cellSize, selectedPiece.y * cellSize, cellSize, cellSize);
    }
}

// 繪製棋子（帶透明度）
function drawPiece(x, y, piece, opacity = 1) {
    ctx.save();
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece.startsWith('w') ? '#fff' : '#000';
    ctx.globalAlpha = opacity;
    const symbols = {
        'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
    };
    ctx.fillText(symbols[piece[1]], x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
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
    whiteScore = board.flat().filter(cell => cell.startsWith('w')).length;
    blackScore = board.flat().filter(cell => cell.startsWith('b')).length;
    document.getElementById('white-score').textContent = whiteScore;
    document.getElementById('black-score').textContent = blackScore;
}

// 簡單的移動合法性檢查（僅示例）
function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('w')) return false; // 玩家只能移動白棋
    return true; // 簡化版，實際需檢查西洋棋規則
}

// AI 移動（隨機選擇黑棋移動）
function aiMove() {
    if (currentPlayer === 'black') {
        let blackPieces = [];
        let emptyOrWhiteCells = [];

        // 收集黑棋位置
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (board[y][x] && board[y][x].startsWith('b')) {
                    blackPieces.push({ x, y });
                }
                if (!board[y][x] || board[y][x].startsWith('w')) {
                    emptyOrWhiteCells.push({ x, y });
                }
            }
        }

        if (blackPieces.length > 0 && emptyOrWhiteCells.length > 0) {
            const from = blackPieces[Math.floor(Math.random() * blackPieces.length)];
            const to = emptyOrWhiteCells[Math.floor(Math.random() * emptyOrWhiteCells.length)];
            const piece = board[from.y][from.x];
            const target = board[to.y][to.x];

            board[from.y][from.x] = '';
            board[to.y][to.x] = piece;

            animatePiece(from.x, from.y, to.x, to.y, piece, () => {
                if (target) updateScoreboard(); // 如果吃子，更新分數
                currentPlayer = 'white';
                document.getElementById('current-player').textContent = '白棋';
                drawBoard();
            });
        }
    }
}

// 玩家移動後觸發 AI
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    if (currentPlayer !== 'white') return; // 限制玩家只能在白棋回合操作

    if (!selectedPiece && board[y][x] && board[y][x].startsWith('w')) {
        // 選擇白棋
        selectedPiece = { x, y };
        drawBoard();
    } else if (selectedPiece) {
        // 移動白棋
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            const target = board[y][x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = piece;

            animatePiece(selectedPiece.x, selectedPiece.y, x, y, piece, () => {
                if (target) updateScoreboard();
                currentPlayer = 'black';
                document.getElementById('current-player').textContent = '黑棋';
                selectedPiece = null;
                drawBoard();
                setTimeout(aiMove, 500); // AI 延遲 0.5 秒移動
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
    currentPlayer = 'white';
    document.getElementById('current-player').textContent = '白棋';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
});

// 初始化
initializeBoard();
drawBoard();
updateScoreboard();
