const canvas = document.getElementById('gomoku-board');
const ctx = canvas.getContext('2d');
const gridSize = 15;
let cellSize, board = [];
let currentPlayer = 'black'; // AI（黑方）先手
let whiteScore = 0, blackScore = 0;
const stoneSound = document.getElementById('stone-sound');
let gameOver = false;
let difficulty = 'easy';
const EASY_DEPTH = 3, HARD_DEPTH = 4;

function resizeCanvas() {
    const containerWidth = document.querySelector('.board-section').offsetWidth;
    const maxWidth = Math.min(containerWidth, 480);
    canvas.width = maxWidth;
    canvas.height = maxWidth;
    cellSize = canvas.width / gridSize;
    drawBoard();
}

function initializeBoard() {
    board = Array(gridSize).fill().map(() => Array(gridSize).fill(''));
    whiteScore = 0;
    blackScore = 0;
    gameOver = false;
    currentPlayer = 'black'; // AI 先手
    updateScoreboard();
    updateCapturedList();
    updateDifficultyDisplay();
    resizeCanvas();
    checkAudio(); // 檢查音效
    setTimeout(aiMove, 500); // AI 黑方先動
}

function checkAudio() {
    if (!stoneSound) {
        console.error('音效元素未找到，請檢查 HTML 中的 <audio id="stone-sound">');
        return;
    }
    stoneSound.load(); // 預載音效
    stoneSound.onerror = () => console.error('音效檔案載入失敗，請確認 ./img/stone-drop.mp3 路徑正確');
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0d9b5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#4a2c00';
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
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x]) drawStone(x, y, board[y][x]);
        }
    }
}

function drawStone(x, y, color) {
    ctx.beginPath();
    ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = color === 'W' ? '#fff' : '#000';
    ctx.fill();
    ctx.strokeStyle = '#4a2c00';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function animateStone(x, y, color, callback) {
    let opacity = 0;
    const duration = 300;
    const startTime = performance.now();

    function step(timestamp) {
        const elapsed = timestamp - startTime;
        opacity = Math.min(elapsed / duration, 1);
        drawBoard();
        ctx.globalAlpha = opacity;
        drawStone(x, y, color);
        ctx.globalAlpha = 1;
        if (elapsed < duration) requestAnimationFrame(step);
        else if (callback) callback();
    }

    if (stoneSound) {
        stoneSound.currentTime = 0;
        stoneSound.play().catch(error => console.error('音效播放失敗:', error));
    } else {
        console.warn('音效未載入，跳過播放');
    }
    requestAnimationFrame(step);
}

function updateScoreboard() {
    document.getElementById('white-score').textContent = `白方：${whiteScore}`;
    document.getElementById('black-score').textContent = `黑方：${blackScore}`;
    const currentPlayerElement = document.getElementById('current-player');
    currentPlayerElement.textContent = `當前玩家：${currentPlayer === 'white' ? '白方' : '黑方'}`;
    currentPlayerElement.classList.remove('white', 'black');
    currentPlayerElement.classList.add(currentPlayer);
}

function updateCapturedList() {
    document.getElementById('white-captured').innerHTML = `白方被吃：<span>0</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>0</span>`;
}

function updateDifficultyDisplay() {
    document.getElementById('difficulty-display').textContent = `模式：${difficulty === 'easy' ? '簡單' : '困難'}`;
}

function isValidMove(x, y) {
    return !board[y][x] && !gameOver; // 僅檢查格子是否為空
}

function checkWin(x, y, color) {
    const directions = [
        [1, 0], [0, 1], [1, 1], [1, -1] // 橫、豎、斜右下、斜右上
    ];
    for (const [dx, dy] of directions) {
        let count = 1;
        for (let i = 1; i < 5; i++) {
            const nx = x + i * dx, ny = y + i * dy;
            if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || board[ny][nx] !== color) break;
            count++;
        }
        for (let i = 1; i < 5; i++) {
            const nx = x - i * dx, ny = y - i * dy;
            if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize || board[ny][nx] !== color) break;
            count++;
        }
        if (count >= 5) return true;
    }
    return false;
}

function evaluateBoard(boardState) {
    let score = 0;
    const weights = { 1: 1, 2: 10, 3: 100, 4: 1000, 5: 10000 };
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x]) {
                const color = boardState[y][x];
                const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
                for (const [dx, dy] of directions) {
                    let count = 0;
                    for (let i = 0; i < 5; i++) {
                        const nx = x + i * dx, ny = y + i * dy;
                        if (nx >= gridSize || ny >= gridSize || (boardState[ny][nx] && boardState[ny][nx] !== color)) break;
                        if (boardState[ny][nx] === color) count++;
                    }
                    score += color === 'W' ? -weights[count] : weights[count];
                }
            }
        }
    }
    return score;
}

function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || checkGameOver(boardState)) return evaluateBoard(boardState);
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (!boardState[y][x]) {
                    const tempBoard = boardState.map(row => [...row]);
                    tempBoard[y][x] = 'B';
                    const evalScore = minimax(tempBoard, depth - 1, alpha, beta, false);
                    maxEval = Math.max(maxEval, evalScore);
                    alpha = Math.max(alpha, evalScore);
                    if (beta <= alpha) break;
                }
            }
        }
        return maxEval === -Infinity ? 0 : maxEval;
    } else {
        let minEval = Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (!boardState[y][x]) {
                    const tempBoard = boardState.map(row => [...row]);
                    tempBoard[y][x] = 'W';
                    const evalScore = minimax(tempBoard, depth - 1, alpha, beta, true);
                    minEval = Math.min(minEval, evalScore);
                    beta = Math.min(beta, evalScore);
                    if (beta <= alpha) break;
                }
            }
        }
        return minEval === Infinity ? 0 : minEval;
    }
}

function checkGameOver(boardState) {
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x] && checkWin(x, y, boardState[y][x])) return true;
        }
    }
    return false;
}

function aiMove() {
    if (currentPlayer !== 'black' || gameOver) return;
    let validMoves = [];
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (!board[y][x]) validMoves.push([x, y]);
        }
    }
    if (validMoves.length > 0) {
        let bestMove = null, bestScore = -Infinity;
        for (const [x, y] of validMoves) {
            const tempBoard = board.map(row => [...row]);
            tempBoard[y][x] = 'B';
            const evalScore = minimax(tempBoard, depth - 1, -Infinity, Infinity, false);
            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestMove = [x, y];
            }
        }
        const [x, y] = bestMove;
        board[y][x] = 'B';
        blackScore++;
        animateStone(x, y, 'B', () => {
            updateScoreboard();
            if (checkWin(x, y, 'B')) {
                alert('黑方勝！');
                gameOver = true;
            } else {
                currentPlayer = 'white';
                document.getElementById('current-player').textContent = '當前玩家：白方';
                drawBoard();
            }
        });
    }
}

function handleMove(e) {
    if (gameOver || currentPlayer !== 'white') return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;

    if (isValidMove(x, y)) {
        board[y][x] = 'W';
        whiteScore++;
        animateStone(x, y, 'W', () => {
            updateScoreboard();
            if (checkWin(x, y, 'W')) {
                alert('白方勝！');
                gameOver = true;
            } else {
                currentPlayer = 'black';
                document.getElementById('current-player').textContent = '當前玩家：黑方';
                drawBoard();
                setTimeout(aiMove, 500);
            }
        });
    }
}

canvas.addEventListener('click', e => handleMove(e));
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleMove(e.touches[0]);
}, { passive: false });

document.getElementById('reset-btn').addEventListener('click', () => {
    initializeBoard();
    drawBoard();
});

document.getElementById('easy-btn').addEventListener('click', () => {
    difficulty = 'easy';
    initializeBoard();
    drawBoard();
    updateDifficultyDisplay();
});

document.getElementById('hard-btn').addEventListener('click', () => {
    difficulty = 'hard';
    initializeBoard();
    drawBoard();
    updateDifficultyDisplay();
});

window.addEventListener('resize', resizeCanvas);

initializeBoard();
drawBoard();
updateScoreboard();
updateCapturedList();
updateDifficultyDisplay();