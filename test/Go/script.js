const canvas = document.getElementById('go-board');
const ctx = canvas.getContext('2d');
const gridSize = 19;
let cellSize, board = [];
let currentPlayer = 'white'; // 玩家（白方）先手
let whiteScore = 0, blackScore = 0;
const stoneSound = document.getElementById('stone-sound');
let gameOver = false, whiteCaptured = 0, blackCaptured = 0;
let difficulty = 'easy';
const EASY_DEPTH = 3, HARD_DEPTH = 4;
let lastMove = null;

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
    whiteCaptured = 0;
    blackCaptured = 0;
    gameOver = false;
    currentPlayer = 'white'; // 玩家先手
    lastMove = null;
    updateCapturedList();
    updateDifficultyDisplay();
    updateScoreboard();
    resizeCanvas();
    checkAudio(); // 檢查音效
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
    const starPoints = [
        [3, 3], [3, 9], [3, 15],
        [9, 3], [9, 9], [9, 15],
        [15, 3], [15, 9], [15, 15]
    ];
    ctx.fillStyle = '#4a2c00';
    starPoints.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x]) drawStone(x, y, board[y][x]);
        }
    }
}

function drawStone(x, y, color) {
    ctx.beginPath();
    ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
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
    document.getElementById('white-captured').innerHTML = `白方被吃：<span>${whiteCaptured}</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>${blackCaptured}</span>`;
}

function updateDifficultyDisplay() {
    document.getElementById('difficulty-display').textContent = `模式：${difficulty === 'easy' ? '簡單' : '困難'}`;
}

function isValidMove(x, y) {
    if (board[y][x] || gameOver) return false;
    if (lastMove && lastMove.x === x && lastMove.y === y) return false; // 簡化劫規則
    const tempBoard = board.map(row => [...row]);
    tempBoard[y][x] = currentPlayer === 'white' ? 'W' : 'B';
    const captured = removeCapturedStones(tempBoard, currentPlayer === 'white' ? 'B' : 'W');
    if (!hasLiberties(tempBoard, x, y, tempBoard[y][x]) && captured.length === 0) return false;
    return true;
}

function hasLiberties(boardState, x, y, color, visited = new Set()) {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || visited.has(`${x},${y}`)) return false;
    visited.add(`${x},${y}`);
    if (!boardState[y][x]) return true;
    if (boardState[y][x] !== color) return false;
    return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => hasLiberties(boardState, nx, ny, color, visited));
}

function removeCapturedStones(boardState, opponentColor) {
    const captured = [];
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x] === opponentColor && !hasLiberties(boardState, x, y, opponentColor)) {
                captured.push([x, y]);
                boardState[y][x] = '';
            }
        }
    }
    return captured;
}

function evaluateBoard(boardState) {
    let score = 0;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x] === 'W') score -= 1;
            if (boardState[y][x] === 'B') score += 1;
        }
    }
    return score;
}

function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0) return evaluateBoard(boardState);
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (isValidMoveForAI(x, y, 'B', boardState)) {
                    const tempBoard = boardState.map(row => [...row]);
                    tempBoard[y][x] = 'B';
                    removeCapturedStones(tempBoard, 'W');
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
                if (isValidMoveForAI(x, y, 'W', boardState)) {
                    const tempBoard = boardState.map(row => [...row]);
                    tempBoard[y][x] = 'W';
                    removeCapturedStones(tempBoard, 'B');
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

function isValidMoveForAI(x, y, color, boardState) {
    if (boardState[y][x]) return false;
    if (lastMove && lastMove.x === x && lastMove.y === y) return false;
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[y][x] = color;
    const captured = removeCapturedStones(tempBoard, color === 'W' ? 'B' : 'W');
    return hasLiberties(tempBoard, x, y, color) || captured.length > 0;
}

function aiMove() {
    if (currentPlayer !== 'black' || gameOver) return;
    let validMoves = [];
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (isValidMoveForAI(x, y, 'B', board)) validMoves.push([x, y]);
        }
    }
    if (validMoves.length > 0) {
        let bestMove = null, bestScore = -Infinity;
        for (const [x, y] of validMoves) {
            const tempBoard = board.map(row => [...row]);
            tempBoard[y][x] = 'B';
            const captured = removeCapturedStones(tempBoard, 'W');
            const evalScore = minimax(tempBoard, depth - 1, -Infinity, Infinity, false);
            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestMove = [x, y];
            }
        }
        const [x, y] = bestMove;
        board[y][x] = 'B';
        const captured = removeCapturedStones(board, 'W');
        whiteCaptured += captured.length;
        blackScore++;
        lastMove = { x, y };
        animateStone(x, y, 'B', () => {
            updateScoreboard();
            updateCapturedList();
            if (!checkGameOver()) {
                currentPlayer = 'white';
                document.getElementById('current-player').textContent = '當前玩家：白方';
                drawBoard();
            }
        });
    } else {
        console.log('黑方無合法移動，遊戲結束');
        gameOver = true;
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
        const captured = removeCapturedStones(board, 'B');
        blackCaptured += captured.length;
        whiteScore++;
        lastMove = { x, y };
        animateStone(x, y, 'W', () => {
            updateScoreboard();
            updateCapturedList();
            if (!checkGameOver()) {
                currentPlayer = 'black';
                document.getElementById('current-player').textContent = '當前玩家：黑方';
                drawBoard();
                setTimeout(aiMove, 500);
            }
        });
    }
}

function checkGameOver() {
    // 簡單判斷是否有棋子被完全吃掉，實際圍棋應計算圍地
    if (whiteScore + blackScore >= gridSize * gridSize) {
        gameOver = true;
        alert(whiteScore > blackScore ? '白方勝！' : '黑方勝！');
        return true;
    }
    return false;
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