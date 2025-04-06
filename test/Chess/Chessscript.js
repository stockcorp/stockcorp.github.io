const canvas = document.getElementById('chess-board');
const ctx = canvas.getContext('2d');
const gridSize = 8;
let cellSize, board = [];
let currentPlayer = 'white';
let whiteScore = 16, blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null, gameOver = false;
let whiteCaptured = [], blackCaptured = [];
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
    board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    whiteScore = 16;
    blackScore = 16;
    gameOver = false;
    whiteCaptured = [];
    blackCaptured = [];
    updateCapturedList();
    updateDifficultyDisplay();
    updateScoreboard();
    resizeCanvas();
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#f0d9b5' : '#8b5a2b';
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            if (board[y][x]) drawPiece(x, y, board[y][x]);
        }
    }
    if (selectedPiece) {
        ctx.strokeStyle = '#a93226';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x * cellSize, selectedPiece.y * cellSize, cellSize, cellSize);
    }
}

function drawPiece(x, y, piece) {
    ctx.font = `bold ${cellSize * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece === piece.toUpperCase() ? '#fff' : '#000';
    ctx.fillText(piece.toUpperCase(), x * cellSize + cellSize / 2, y * cellSize + cellSize / 2 + 5);
}

function animatePiece(fromX, fromY, toX, toY, piece, callback) {
    let opacity = 0;
    const duration = 300;
    const startTime = performance.now();

    function step(timestamp) {
        const elapsed = timestamp - startTime;
        opacity = Math.min(elapsed / duration, 1);
        drawBoard();
        ctx.globalAlpha = opacity;
        drawPiece(toX, toY, piece);
        ctx.globalAlpha = 1;
        if (elapsed < duration) requestAnimationFrame(step);
        else if (callback) callback();
    }

    stoneSound.currentTime = 0;
    stoneSound.play().catch(() => {});
    requestAnimationFrame(step);
}

function updateScoreboard() {
    whiteScore = board.flat().filter(cell => /[A-Z]/.test(cell)).length;
    blackScore = board.flat().filter(cell => /[a-z]/.test(cell)).length;
    document.getElementById('white-score').textContent = `白方：${whiteScore}`;
    document.getElementById('black-score').textContent = `黑方：${blackScore}`;
    const currentPlayerElement = document.getElementById('current-player');
    currentPlayerElement.textContent = `當前玩家：${currentPlayer === 'white' ? '白方' : '黑方'}`;
    currentPlayerElement.classList.remove('white', 'black');
    currentPlayerElement.classList.add(currentPlayer);
}

function updateCapturedList() {
    document.getElementById('white-captured').innerHTML = `白方被吃：<span>${whiteCaptured.join(', ')}</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>${blackCaptured.join(', ')}</span>`;
}

function updateDifficultyDisplay() {
    document.getElementById('difficulty-display').textContent = `模式：${difficulty === 'easy' ? '簡單' : '困難'}`;
}

function checkGameOver() {
    const whiteKing = board.flat().includes('K');
    const blackKing = board.flat().includes('k');
    if (!whiteKing) {
        gameOver = true;
        alert('黑方勝！');
    } else if (!blackKing) {
        gameOver = true;
        alert('白方勝！');
    }
    return gameOver;
}

function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || piece !== piece.toUpperCase()) return false;
    const target = board[toY][toX];
    if (target && target === target.toUpperCase()) return false;
    const dx = Math.abs(toX - fromX), dy = Math.abs(toY - fromY);
    switch (piece.toLowerCase()) {
        case 'k':
            return (dx <= 1 && dy <= 1) && !isKingInCheckAfterMove(fromX, fromY, toX, toY);
        case 'q':
            return (dx === 0 || dy === 0 || dx === dy) && isPathClear(fromX, fromY, toX, toY);
        case 'r':
            return (dx === 0 || dy === 0) && isPathClear(fromX, fromY, toX, toY);
        case 'b':
            return (dx === dy) && isPathClear(fromX, fromY, toX, toY);
        case 'n':
            return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
        case 'p':
            if (toY === fromY - 1 && dx === 0 && !target) return true;
            if (fromY === 6 && toY === 4 && dx === 0 && !target && !board[5][fromX]) return true;
            if (toY === fromY - 1 && dx === 1 && target) return true;
            return false;
        default:
            return false;
    }
}

function isPathClear(fromX, fromY, toX, toY) {
    const dx = Math.sign(toX - fromX), dy = Math.sign(toY - fromY);
    let x = fromX + dx, y = fromY + dy;
    while (x !== toX || y !== toY) {
        if (board[y][x]) return false;
        x += dx; y += dy;
    }
    return true;
}

function isKingInCheckAfterMove(fromX, fromY, toX, toY) {
    const tempBoard = board.map(row => [...row]);
    tempBoard[toY][toX] = tempBoard[fromY][fromX];
    tempBoard[fromY][fromX] = '';
    return isKingInCheck(tempBoard, currentPlayer);
}

function isKingInCheck(boardState, color) {
    const king = color === 'white' ? 'K' : 'k';
    let kingX, kingY;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x] === king) {
                kingX = x;
                kingY = y;
                break;
            }
        }
    }
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x] && boardState[y][x] === boardState[y][x].toLowerCase() && isValidMoveForAI(x, y, kingX, kingY)) {
                return true;
            }
        }
    }
    return false;
}

function getPieceValue(piece) {
    const values = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 1000 };
    return piece ? values[piece.toLowerCase()] || 0 : 0;
}

function evaluateBoard(boardState) {
    let score = 0;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const piece = boardState[y][x];
            if (piece) {
                const value = getPieceValue(piece);
                score += piece === piece.toUpperCase() ? -value : value;
            }
        }
    }
    return score;
}

function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || checkGameOverBoard(boardState)) return evaluateBoard(boardState);
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (boardState[y][x] && boardState[y][x] === boardState[y][x].toLowerCase()) {
                    const moves = getValidMovesForAI(x, y);
                    for (const [tx, ty] of moves) {
                        const tempBoard = boardState.map(row => [...row]);
                        tempBoard[ty][tx] = tempBoard[y][x];
                        tempBoard[y][x] = '';
                        const evalScore = minimax(tempBoard, depth - 1, alpha, beta, false);
                        maxEval = Math.max(maxEval, evalScore);
                        alpha = Math.max(alpha, evalScore);
                        if (beta <= alpha) break;
                    }
                }
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (boardState[y][x] && boardState[y][x] === boardState[y][x].toUpperCase()) {
                    const moves = getValidMoves(x, y);
                    for (const [tx, ty] of moves) {
                        const tempBoard = boardState.map(row => [...row]);
                        tempBoard[ty][tx] = tempBoard[y][x];
                        tempBoard[y][x] = '';
                        const evalScore = minimax(tempBoard, depth - 1, alpha, beta, true);
                        minEval = Math.min(minEval, evalScore);
                        beta = Math.min(beta, evalScore);
                        if (beta <= alpha) break;
                    }
                }
            }
        }
        return minEval;
    }
}

function checkGameOverBoard(boardState) {
    return !boardState.flat().includes('K') || !boardState.flat().includes('k');
}

function getValidMoves(fromX, fromY) {
    const moves = [];
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (isValidMove(fromX, fromY, x, y)) moves.push([x, y]);
        }
    }
    return moves;
}

function isValidMoveForAI(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || piece !== piece.toLowerCase()) return false;
    const target = board[toY][toX];
    if (target && target === target.toLowerCase()) return false;
    const dx = Math.abs(toX - fromX), dy = Math.abs(toY - fromY);
    switch (piece) {
        case 'k':
            return (dx <= 1 && dy <= 1);
        case 'q':
            return (dx === 0 || dy === 0 || dx === dy) && isPathClear(fromX, fromY, toX, toY);
        case 'r':
            return (dx === 0 || dy === 0) && isPathClear(fromX, fromY, toX, toY);
        case 'b':
            return (dx === dy) && isPathClear(fromX, fromY, toX, toY);
        case 'n':
            return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
        case 'p':
            if (toY === fromY + 1 && dx === 0 && !target) return true;
            if (fromY === 1 && toY === 3 && dx === 0 && !target && !board[2][fromX]) return true;
            if (toY === fromY + 1 && dx === 1 && target) return true;
            return false;
        default:
            return false;
    }
}

function getValidMovesForAI(fromX, fromY) {
    const moves = [];
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (isValidMoveForAI(fromX, fromY, x, y)) moves.push([x, y]);
        }
    }
    return moves;
}

function aiMove() {
    if (currentPlayer !== 'black' || gameOver) return;
    let validMoves = [];
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] && board[y][x] === board[y][x].toLowerCase()) {
                const moves = getValidMovesForAI(x, y);
                moves.forEach(move => validMoves.push({ fromX: x, fromY: y, toX: move[0], toY: move[1] }));
            }
        }
    }
    if (validMoves.length > 0) {
        let bestMove = null, bestScore = -Infinity;
        for (const move of validMoves) {
            const tempBoard = board.map(row => [...row]);
            tempBoard[move.toY][move.toX] = tempBoard[move.fromY][move.fromX];
            tempBoard[move.fromY][move.fromX] = '';
            const evalScore = minimax(tempBoard, depth - 1, -Infinity, Infinity, false);
            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestMove = move;
            }
        }
        const piece = board[bestMove.fromY][bestMove.fromX];
        const target = board[bestMove.toY][bestMove.toX];
        board[bestMove.fromY][bestMove.fromX] = '';
        board[bestMove.toY][bestMove.toX] = piece;
        if (target) whiteCaptured.push(target);
        animatePiece(bestMove.fromX, bestMove.fromY, bestMove.toX, bestMove.toY, piece, () => {
            updateScoreboard();
            updateCapturedList();
            if (!checkGameOver()) {
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
    const x = Math.floor((e.x - rect.left) / cellSize);
    const y = Math.floor((e.y - rect.top) / cellSize);
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    if (!selectedPiece && board[y][x] && board[y][x] === board[y][x].toUpperCase()) {
        selectedPiece = { x, y };
        drawBoard();
    } else if (selectedPiece) {
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            const target = board[y][x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = piece;
            if (target) blackCaptured.push(target);
            animatePiece(selectedPiece.x, selectedPiece.y, x, y, piece, () => {
                updateScoreboard();
                updateCapturedList();
                selectedPiece = null;
                if (!checkGameOver()) {
                    currentPlayer = 'black';
                    document.getElementById('current-player').textContent = '當前玩家：黑方';
                    drawBoard();
                    setTimeout(aiMove, 500);
                }
            });
        } else {
            selectedPiece = null;
            drawBoard();
        }
    }
}

canvas.addEventListener('click', e => handleMove({ x: e.clientX, y: e.clientY }));
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove({ x: touch.clientX, y: touch.clientY });
}, { passive: false });

document.getElementById('reset-btn').addEventListener('click', () => {
    initializeBoard();
    currentPlayer = 'white';
    document.getElementById('current-player').textContent = '當前玩家：白方';
    selectedPiece = null;
    drawBoard();
});

document.getElementById('easy-btn').addEventListener('click', () => {
    difficulty = 'easy';
    initializeBoard();
    currentPlayer = 'white';
    document.getElementById('current-player').textContent = '當前玩家：白方';
    selectedPiece = null;
    drawBoard();
    updateDifficultyDisplay();
});

document.getElementById('hard-btn').addEventListener('click', () => {
    difficulty = 'hard';
    initializeBoard();
    currentPlayer = 'white';
    document.getElementById('current-player').textContent = '當前玩家：白方';
    selectedPiece = null;
    drawBoard();
    updateDifficultyDisplay();
});

window.addEventListener('resize', resizeCanvas);

initializeBoard();
drawBoard();
updateScoreboard();
updateCapturedList();
updateDifficultyDisplay();