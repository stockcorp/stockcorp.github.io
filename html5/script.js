const canvas = document.getElementById('go-board');
const ctx = canvas.getContext('2d');
const gridSize = 19;
const cellSize = canvas.width / gridSize;
let board = Array(gridSize).fill().map(() => Array(gridSize).fill(0)); // 0: 空, 1: 黑棋, 2: 白棋
let currentPlayer = 1; // 1: 黑棋 (玩家), 2: 白棋 (AI)
let blackScore = 0;
let whiteScore = 0;

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d9b382';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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

    const starPoints = [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    ctx.fillStyle = '#333';
    starPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] === 1) drawStone(x, y, '#000');
            if (board[y][x] === 2) drawStone(x, y, '#fff');
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

// 更新計分板
function updateScoreboard() {
    blackScore = board.flat().filter(cell => cell === 1).length;
    whiteScore = board.flat().filter(cell => cell === 2).length;
    document.getElementById('black-score').textContent = blackScore;
    document.getElementById('white-score').textContent = whiteScore;
}

// AI 落子（隨機模式）
function aiMove() {
    if (currentPlayer === 2) {
        let emptyCells = [];
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (board[y][x] === 0) emptyCells.push([x, y]);
            }
        }
        if (emptyCells.length > 0) {
            const [x, y] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            board[y][x] = 2;
            currentPlayer = 1;
            document.getElementById('current-player').textContent = '黑棋';
            drawBoard();
            updateScoreboard();
        }
    }
}

// 玩家落子後觸發 AI
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    if (board[y][x] === 0 && currentPlayer === 1) {
        board[y][x] = 1; // 玩家落黑棋
        currentPlayer = 2;
        document.getElementById('current-player').textContent = '白棋';
        drawBoard();
        updateScoreboard();

        // 延遲 0.5 秒讓 AI 落子，模擬思考
        setTimeout(() => {
            aiMove();
        }, 500);
    }
});

// 重置遊戲
document.getElementById('reset-btn').addEventListener('click', () => {
    board = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    currentPlayer = 1;
    blackScore = 0;
    whiteScore = 0;
    document.getElementById('current-player').textContent = '黑棋';
    drawBoard();
    updateScoreboard();
});

// 初始化
drawBoard();
updateScoreboard();
