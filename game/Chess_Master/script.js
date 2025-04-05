const canvas = document.getElementById('chess-board');
const ctx = canvas.getContext('2d');
const gridSize = 8;
const cellSize = canvas.width / gridSize;
let board = [];
let currentPlayer = 'white'; // 'white' 或 'black'
let whiteScore = 16;
let blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null; // 選中的棋子位置

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
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製格子
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#f0d9b5' : '#b58863'; // 淺色與深色格
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

// 處理點擊
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect
