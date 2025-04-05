const canvas = document.getElementById('go-board');
const ctx = canvas.getContext('2d');
const gridSize = 19; // 19x19 標準圍棋棋盤
const cellSize = canvas.width / gridSize;
let board = Array(gridSize).fill().map(() => Array(gridSize).fill(0)); // 0: 空, 1: 黑棋, 2: 白棋
let currentPlayer = 1; // 1: 黑棋, 2: 白棋

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d9b382';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 畫格線
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellSize + cellSize / 2, cellSize / 2);
        ctx.lineTo(i * cellSize + cellSize / 2, canvas.height - cellSize / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cellSize / 2, i * cellSize + cellSize / 2);
        ctx.lineTo(canvas.width - cellSize / 2, i * cellSize + cellSize / 2);
        ctx.stroke();
    }

    // 畫星點（天元等）
    const starPoints = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    ctx.fillStyle = '#333';
    starPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 畫棋子
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] === 1) drawStone(x, y, '#000'); // 黑棋
            if (board[y][x] === 2) drawStone(x, y, '#fff'); // 白棋
        }
    }
}

// 繪製棋子
function drawStone(x, y, color) {
    ctx.beginPath();
    ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// 處理點擊落子
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    if (board[y][x] === 0) {
        board[y][x] = currentPlayer;
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        document.getElementById('current-player').textContent = currentPlayer === 1 ? '黑棋' : '白棋';
        drawBoard();
    }
});

// 重置遊戲
document.getElementById('reset-btn').addEventListener('click', () => {
    board = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    currentPlayer = 1;
    document.getElementById('current-player').textContent = '黑棋';
    drawBoard();
});

// 初始化
drawBoard();