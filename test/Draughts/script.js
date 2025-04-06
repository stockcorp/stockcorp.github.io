const canvas = document.getElementById('draughts-board');
const ctx = canvas.getContext('2d');
const gridSize = 10;
let cellSize, board = [];
let currentPlayer = 'white';
let whiteScore = 20, blackScore = 20;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null, gameOver = false;
let whiteCaptured = 0, blackCaptured = 0;
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
    for (let i = 0; i < 20; i++) {
        const x = (i % 5) * 2 + (Math.floor(i / 5) % 2 === 0 ? 1 : 0);
        const y = Math.floor(i / 5);
        board[y][x] = 'B'; // 黑方普通棋子
    }
    for (let i = 0; i < 20; i++) {
        const x = (i % 5) * 2 + (Math.floor(i / 5) % 2 === 0 ? 1 : 0);
        const y = gridSize - 1 - Math.floor(i / 5);
        board[y][x] = 'W'; // 白方普通棋子
    }
    whiteScore = 20;
    blackScore = 20;
    whiteCaptured = 0;
    blackCaptured = 0;
    gameOver = false;
    currentPlayer = 'white';
    selectedPiece = null;
    updateScoreboard();
    updateCapturedList();
    updateDifficultyDisplay();
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
    ctx.beginPath();
    ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = piece.includes('W') ? '#fff' : '#000';
    ctx.fill();
    ctx.strokeStyle = '#4a2c00';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (piece.includes('K')) {
        ctx.fillStyle = '#d4a017';
        ctx.font = `bold ${cellSize * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('K', x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
    }
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

function getValidMoves(x, y) {
    const piece = board[y][x];
    if (!piece || (currentPlayer === 'white' && !piece.includes('W')) || (currentPlayer === 'black' && !piece.includes('B'))) return [];
    const moves = [];
    const isKing = piece.includes('K');
    const directions = isKing ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : currentPlayer === 'white' ? [[1, -1], [-1, -1]] : [[1, 1], [-1, 1]];

    // 普通移動
    for (const [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !board[ny][nx]) moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: [] });
    }

    // 吃子移動
    const captureMoves = getCaptureMoves(x, y, piece, []);
    if (captureMoves.length > 0) return captureMoves;

    return moves;
}

function getCaptureMoves(x, y, piece, captured, visited = new Set()) {
    const moves = [];
    const isKing = piece.includes('K');
    const opponent = currentPlayer === 'white' ? 'B' : 'W';
    const directions = isKing ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : currentPlayer === 'white' ? [[1, -1], [-1, -1]] : [[1, 1], [-1, 1]];
    visited.add(`${x},${y}`);

    for (const [dx, dy] of directions) {
        const nx = x + dx * 2, ny = y + dy * 2;
        const mx = x + dx, my = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !board[ny][nx] &&
            board[my][mx] && board[my][mx].includes(opponent) && !captured.some(c => c[0] === mx && c[1] === my)) {
            const newCaptured = [...captured, [mx, my]];
            moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: newCaptured });
            if (isKing) {
                const furtherMoves = getCaptureMoves(nx, ny, piece, newCaptured, new Set(visited));
                moves.push(...furtherMoves);
            }
        }
    }
    if (isKing) {
        for (const [dx, dy] of directions) {
            let step = 2;
            while (true) {
                const nx = x + dx * step, ny = y + dy * step;
                const mx = x + dx * (step - 1), my = y + dy * (step - 1);
                if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) break;
                if (board[ny][nx]) break;
                if (board[my][mx] && board[my][mx].includes(opponent) && !captured.some(c => c[0] === mx && c[1] === my)) {
                    const newCaptured = [...captured, [mx, my]];
                    moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: newCaptured });
                    const furtherMoves = getCaptureMoves(nx, ny, piece, newCaptured, new Set(visited));
                    moves.push(...furtherMoves);
                    break;
                }
                step++;
            }
        }
    }
    return moves;
}

function hasCaptureMoves() {
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] && board[y][x].includes(currentPlayer === 'white' ? 'W' : 'B')) {
                const captureMoves = getCaptureMoves(x, y, board[y][x], []);
                if (captureMoves.length > 0) return true;
            }
        }
    }
    return false;
}

function getMaxCaptureMove(moves) {
    let maxCaptures = 0;
    let bestMoves = [];
    for (const move of moves) {
        if (move.captures.length > maxCaptures) {
            maxCaptures = move.captures.length;
            bestMoves = [move];
        } else if (move.captures.length === maxCaptures) {
            bestMoves.push(move);
        }
    }
    return bestMoves;
}

function checkGameOver() {
    if (whiteScore === 0) {
        gameOver = true;
        alert('黑方勝！');
        return true;
    }
    if (blackScore === 0) {
        gameOver = true;
        alert('白方勝！');
        return true;
    }
    let hasMoves = false;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] && board[y][x].includes(currentPlayer === 'white' ? 'W' : 'B')) {
                if (getValidMoves(x, y).length > 0) {
                    hasMoves = true;
                    break;
                }
            }
        }
        if (hasMoves) break;
    }
    if (!hasMoves) {
        gameOver = true;
        alert(`${currentPlayer === 'white' ? '黑方' : '白方'}勝！`);
        return true;
    }
    return false;
}

function evaluateBoard(boardState) {
    let score = 0;
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (boardState[y][x]) {
                const value = boardState[y][x].includes('K') ? 3 : 1;
                score += boardState[y][x].includes('W') ? -value : value;
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
                if (boardState[y][x] && boardState[y][x].includes('B')) {
                    const moves = getValidMovesForAI(x, y, boardState);
                    for (const move of moves) {
                        const tempBoard = applyMove(boardState, move);
                        const evalScore = minimax(tempBoard, depth - 1, alpha, beta, false);
                        maxEval = Math.max(maxEval, evalScore);
                        alpha = Math.max(alpha, evalScore);
                        if (beta <= alpha) break;
                    }
                }
            }
        }
        return maxEval === -Infinity ? 0 : maxEval;
    } else {
        let minEval = Infinity;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (boardState[y][x] && boardState[y][x].includes('W')) {
                    const moves = getValidMoves(x, y);
                    for (const move of moves) {
                        const tempBoard = applyMove(boardState, move);
                        const evalScore = minimax(tempBoard, depth - 1, alpha, beta, true);
                        minEval = Math.min(minEval, evalScore);
                        beta = Math.min(beta, evalScore);
                        if (beta <= alpha) break;
                    }
                }
            }
        }
        return minEval === Infinity ? 0 : minEval;
    }
}

function checkGameOverBoard(boardState) {
    const whiteCount = boardState.flat().filter(p => p && p.includes('W')).length;
    const blackCount = boardState.flat().filter(p => p && p.includes('B')).length;
    if (whiteCount === 0 || blackCount === 0) return true;
    return false;
}

function getValidMovesForAI(x, y, boardState) {
    const piece = boardState[y][x];
    if (!piece || !piece.includes('B')) return [];
    const moves = [];
    const isKing = piece.includes('K');
    const directions = isKing ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[1, 1], [-1, 1]];

    for (const [dx, dy] of directions) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !boardState[ny][nx]) moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: [] });
    }

    const captureMoves = getCaptureMovesForAI(x, y, piece, [], boardState);
    return captureMoves.length > 0 ? captureMoves : moves;
}

function getCaptureMovesForAI(x, y, piece, captured, boardState, visited = new Set()) {
    const moves = [];
    const isKing = piece.includes('K');
    const opponent = 'W';
    const directions = isKing ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[1, 1], [-1, 1]];
    visited.add(`${x},${y}`);

    for (const [dx, dy] of directions) {
        const nx = x + dx * 2, ny = y + dy * 2;
        const mx = x + dx, my = y + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize && !boardState[ny][nx] &&
            boardState[my][mx] && boardState[my][mx].includes(opponent) && !captured.some(c => c[0] === mx && c[1] === my)) {
            const newCaptured = [...captured, [mx, my]];
            moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: newCaptured });
            if (isKing) {
                const furtherMoves = getCaptureMovesForAI(nx, ny, piece, newCaptured, boardState, new Set(visited));
                moves.push(...furtherMoves);
            }
        }
    }
    if (isKing) {
        for (const [dx, dy] of directions) {
            let step = 2;
            while (true) {
                const nx = x + dx * step, ny = y + dy * step;
                const mx = x + dx * (step - 1), my = y + dy * (step - 1);
                if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) break;
                if (boardState[ny][nx]) break;
                if (boardState[my][mx] && boardState[my][mx].includes(opponent) && !captured.some(c => c[0] === mx && c[1] === my)) {
                    const newCaptured = [...captured, [mx, my]];
                    moves.push({ fromX: x, fromY: y, toX: nx, toY: ny, captures: newCaptured });
                    const furtherMoves = getCaptureMovesForAI(nx, ny, piece, newCaptured, boardState, new Set(visited));
                    moves.push(...furtherMoves);
                    break;
                }
                step++;
            }
        }
    }
    return moves;
}

function applyMove(boardState, move) {
    const tempBoard = boardState.map(row => [...row]);
    let piece = tempBoard[move.fromY][move.fromX];
    if (currentPlayer === 'white' && move.toY <= 0) piece = 'WK';
    if (currentPlayer === 'black' && move.toY >= gridSize - 1) piece = 'BK';
    tempBoard[move.toY][move.toX] = piece;
    tempBoard[move.fromY][move.fromX] = '';
    move.captures.forEach(([cx, cy]) => tempBoard[cy][cx] = '');
    return tempBoard;
}

function aiMove() {
    if (currentPlayer !== 'black' || gameOver) return;
    let allMoves = [];
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (board[y][x] && board[y][x].includes('B')) {
                allMoves.push(...getValidMovesForAI(x, y, board));
            }
        }
    }
    if (allMoves.length === 0) {
        gameOver = true;
        alert('白方勝！');
        return;
    }
    const captureMoves = allMoves.filter(m => m.captures.length > 0);
    const movesToConsider = captureMoves.length > 0 ? getMaxCaptureMove(captureMoves) : allMoves;
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;
    let bestMove = null, bestScore = -Infinity;
    for (const move of movesToConsider) {
        const tempBoard = applyMove(board, move);
        const evalScore = minimax(tempBoard, depth - 1, -Infinity, Infinity, false);
        if (evalScore > bestScore) {
            bestScore = evalScore;
            bestMove = move;
        }
    }
    const piece = board[bestMove.fromY][bestMove.fromX];
    board[bestMove.fromY][bestMove.fromX] = '';
    board[bestMove.toY][bestMove.toX] = bestMove.toY >= gridSize - 1 ? 'BK' : piece;
    whiteCaptured += bestMove.captures.length;
    whiteScore -= bestMove.captures.length;
    bestMove.captures.forEach(([cx, cy]) => board[cy][cx] = '');
    animatePiece(bestMove.fromX, bestMove.fromY, bestMove.toX, bestMove.toY, board[bestMove.toY][bestMove.toX], () => {
        updateScoreboard();
        updateCapturedList();
        if (!checkGameOver()) {
            currentPlayer = 'white';
            document.getElementById('current-player').textContent = '當前玩家：白方';
            drawBoard();
        }
    });
}

function handleMove(e) {
    if (gameOver || currentPlayer !== 'white') return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
    if (selectedPiece) {
        const moves = getValidMoves(selectedPiece.x, selectedPiece.y);
        const move = moves.find(m => m.toX === x && m.toY === y);
        if (move && (!hasCaptureMoves() || move.captures.length > 0)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = y === 0 ? 'WK' : piece;
            blackCaptured += move.captures.length;
            blackScore -= move.captures.length;
            move.captures.forEach(([cx, cy]) => board[cy][cx] = '');
            animatePiece(selectedPiece.x, selectedPiece.y, x, y, board[y][x], () => {
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
    } else if (board[y][x] && board[y][x].includes('W')) {
        const moves = getValidMoves(x, y);
        if (moves.length > 0 && (!hasCaptureMoves() || moves.some(m => m.captures.length > 0))) {
            selectedPiece = { x, y };
            drawBoard();
        }
    }
}

canvas.addEventListener('click', e => handleMove(e));
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch);
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