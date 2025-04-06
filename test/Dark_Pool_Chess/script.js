const canvas = document.getElementById('dark-pool-board');
const ctx = canvas.getContext('2d');
const gridWidth = 8, gridHeight = 4;
let cellWidth, cellHeight, board = [];
let currentPlayer = 'red'; // 初始為紅方，翻棋後可能變更
let playerColor = null, aiColor = null; // 玩家和 AI 的陣營，翻第一枚棋子後確定
let redScore = 16, blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null, gameOver = false;
let redCaptured = [], blackCaptured = [];
let difficulty = 'easy';
const EASY_DEPTH = 3, HARD_DEPTH = 4;
let firstMove = true; // 標記是否為第一步翻棋

function resizeCanvas() {
    const containerWidth = document.querySelector('.board-section').offsetWidth;
    const maxWidth = Math.min(containerWidth, 480);
    canvas.width = maxWidth;
    canvas.height = maxWidth / 2;
    cellWidth = canvas.width / gridWidth;
    cellHeight = canvas.height / gridHeight;
    drawBoard();
}

function initializeBoard() {
    const pieces = [
        'K', 'A', 'A', 'B', 'B', 'N', 'N', 'R', 'R', 'P', 'P', 'S', 'S', 'S', 'S', 'S',
        'k', 'a', 'a', 'b', 'b', 'n', 'n', 'r', 'r', 'p', 'p', 's', 's', 's', 's', 's'
    ];
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    board = Array(gridHeight).fill().map(() => Array(gridWidth).fill(''));
    let index = 0;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            board[y][x] = { piece: pieces[index++], revealed: false };
        }
    }
    redScore = 16;
    blackScore = 16;
    redCaptured = [];
    blackCaptured = [];
    gameOver = false;
    currentPlayer = 'red'; // 玩家先翻棋
    playerColor = null;
    aiColor = null;
    firstMove = true;
    selectedPiece = null;
    updateScoreboard();
    updateCapturedList();
    updateDifficultyDisplay();
    resizeCanvas();
    checkAudio(); // 檢查音效是否可用
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
    for (let x = 0; x <= gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth, 0);
        ctx.lineTo(x * cellWidth, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellHeight);
        ctx.lineTo(canvas.width, y * cellHeight);
        ctx.stroke();
    }
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const { piece, revealed } = board[y][x];
            if (revealed && piece) drawPiece(x, y, piece);
            else if (!revealed) drawHidden(x, y);
        }
    }
    if (selectedPiece) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x * cellWidth, selectedPiece.y * cellHeight, cellWidth, cellHeight);
    }
}

function drawHidden(x, y) {
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x * cellWidth + 2, y * cellHeight + 2, cellWidth - 4, cellHeight - 4);
}

function drawPiece(x, y, piece) {
    ctx.beginPath();
    ctx.arc(x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2, cellWidth / 2 - 2, 0, Math.PI * 2);
    ctx.fillStyle = piece === piece.toUpperCase() ? '#e74c3c' : '#333';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${cellWidth * 0.5}px KaiTi`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbols = { K: '將', A: '士', B: '象', N: '馬', R: '車', P: '炮', S: '兵', k: '帥', a: '士', b: '相', n: '馬', r: '車', p: '炮', s: '卒' };
    ctx.fillText(symbols[piece], x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2);
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
        if (fromX === toX && fromY === toY) drawPiece(toX, toY, piece); // 翻棋時不移動
        else drawPiece(toX, toY, piece);
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
    redScore = board.flat().filter(cell => cell.piece && cell.piece === cell.piece.toUpperCase()).length;
    blackScore = board.flat().filter(cell => cell.piece && cell.piece === cell.piece.toLowerCase()).length;
    document.getElementById('red-score').textContent = `紅方：${redScore}`;
    document.getElementById('black-score').textContent = `黑方：${blackScore}`;
    const currentPlayerElement = document.getElementById('current-player');
    currentPlayerElement.textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
    currentPlayerElement.classList.remove('red', 'black');
    currentPlayerElement.classList.add(currentPlayer);
}

function updateCapturedList() {
    const symbols = { K: '將', A: '士', B: '象', N: '馬', R: '車', P: '炮', S: '兵', k: '帥', a: '士', b: '相', n: '馬', r: '車', p: '炮', s: '卒' };
    document.getElementById('red-captured').innerHTML = `紅方被吃：<span>${redCaptured.map(p => symbols[p]).join(', ')}</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>${blackCaptured.map(p => symbols[p]).join(', ')}</span>`;
}

function updateDifficultyDisplay() {
    document.getElementById('difficulty-display').textContent = `模式：${difficulty === 'easy' ? '簡單' : '困難'}`;
}

function checkGameOver() {
    if (!board.flat().some(cell => cell.piece === 'K')) {
        gameOver = true;
        alert('黑方勝！');
        return true;
    }
    if (!board.flat().some(cell => cell.piece === 'k')) {
        gameOver = true;
        alert('紅方勝！');
        return true;
    }
    return false;
}

function canEat(attacker, defender) {
    const rank = { K: 7, A: 6, B: 5, R: 4, N: 3, P: 2, S: 1, k: 7, a: 6, b: 5, r: 4, n: 3, p: 2, s: 1 };
    if (attacker === 'S' && defender === 'k') return true;
    if (attacker === 's' && defender === 'K') return true;
    if (attacker === 'P' || attacker === 'p') return rank[defender] <= rank[attacker];
    return rank[attacker] >= rank[defender];
}

function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX].piece;
    if (!piece || (playerColor === 'red' && !piece.match(/[KABNRPS]/)) || (playerColor === 'black' && !piece.match(/[kabnrps]/))) return false;
    const target = board[toY][toX].piece;
    const dx = Math.abs(toX - fromX), dy = Math.abs(toY - fromY);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return false;
    if (!target) return true;
    if (piece === 'P' || piece === 'p') {
        const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
        return dx === 1 && dy === 1 && board[midY][midX].piece && canEat(piece, target);
    }
    return canEat(piece, target);
}

function evaluateBoard(boardState) {
    let score = 0;
    const values = { K: 1000, A: 2, B: 2, N: 4, R: 9, P: 4.5, S: 1, k: 1000, a: 2, b: 2, n: 4, r: 9, p: 4.5, s: 1 };
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const piece = boardState[y][x].piece;
            if (piece) score += piece === piece.toUpperCase() ? -values[piece] : values[piece];
        }
    }
    return score;
}

function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || checkGameOverBoard(boardState)) return evaluateBoard(boardState);
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = boardState[y][x];
                if (aiColor && !cell.revealed) {
                    const tempBoard = boardState.map(row => row.map(c => ({ ...c })));
                    tempBoard[y][x].revealed = true;
                    const evalScore = minimax(tempBoard, depth - 1, alpha, beta, false);
                    maxEval = Math.max(maxEval, evalScore);
                    alpha = Math.max(alpha, evalScore);
                    if (beta <= alpha) break;
                } else if (cell.piece && cell.piece.match(aiColor === 'red' ? /[KABNRPS]/ : /[kabnrps]/)) {
                    for (let ty = 0; ty < gridHeight; ty++) {
                        for (let tx = 0; tx < gridWidth; tx++) {
                            if (isValidMoveForAI(x, y, tx, ty, boardState)) {
                                const tempBoard = applyMove(boardState, x, y, tx, ty);
                                const evalScore = minimax(tempBoard, depth - 1, alpha, beta, false);
                                maxEval = Math.max(maxEval, evalScore);
                                alpha = Math.max(alpha, evalScore);
                                if (beta <= alpha) break;
                            }
                        }
                    }
                }
            }
        }
        return maxEval === -Infinity ? 0 : maxEval;
    } else {
        let minEval = Infinity;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = boardState[y][x];
                if (playerColor && !cell.revealed) {
                    const tempBoard = boardState.map(row => row.map(c => ({ ...c })));
                    tempBoard[y][x].revealed = true;
                    const evalScore = minimax(tempBoard, depth - 1, alpha, beta, true);
                    minEval = Math.min(minEval, evalScore);
                    beta = Math.min(beta, evalScore);
                    if (beta <= alpha) break;
                } else if (cell.piece && cell.piece.match(playerColor === 'red' ? /[KABNRPS]/ : /[kabnrps]/)) {
                    for (let ty = 0; ty < gridHeight; ty++) {
                        for (let tx = 0; tx < gridWidth; tx++) {
                            if (isValidMove(x, y, tx, ty)) {
                                const tempBoard = applyMove(boardState, x, y, tx, ty);
                                const evalScore = minimax(tempBoard, depth - 1, alpha, beta, true);
                                minEval = Math.min(minEval, evalScore);
                                beta = Math.min(beta, evalScore);
                                if (beta <= alpha) break;
                            }
                        }
                    }
                }
            }
        }
        return minEval === Infinity ? 0 : minEval;
    }
}

function checkGameOverBoard(boardState) {
    return !boardState.flat().some(cell => cell.piece === 'K') || !boardState.flat().some(cell => cell.piece === 'k');
}

function isValidMoveForAI(fromX, fromY, toX, toY, boardState) {
    const piece = boardState[fromY][fromX].piece;
    if (!piece || !piece.match(aiColor === 'red' ? /[KABNRPS]/ : /[kabnrps]/)) return false;
    const target = boardState[toY][toX].piece;
    const dx = Math.abs(toX - fromX), dy = Math.abs(toY - fromY);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return false;
    if (!target) return true;
    if (piece === 'P' || piece === 'p') {
        const midX = (fromX + toX) / 2, midY = (fromY + toY) / 2;
        return dx === 1 && dy === 1 && boardState[midY][midX].piece && canEat(piece, target);
    }
    return canEat(piece, target);
}

function applyMove(boardState, fromX, fromY, toX, toY) {
    const tempBoard = boardState.map(row => row.map(c => ({ ...c })));
    const piece = tempBoard[fromY][fromX].piece;
    if (tempBoard[toY][toX].piece) {
        if (piece === piece.toUpperCase()) blackCaptured.push(tempBoard[toY][toX].piece);
        else redCaptured.push(tempBoard[toY][toX].piece);
    }
    tempBoard[toY][toX] = { piece, revealed: true };
    tempBoard[fromY][fromX] = { piece: '', revealed: false };
    return tempBoard;
}

function aiMove() {
    if (gameOver || currentPlayer !== aiColor) return;
    let validMoves = [];
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (!board[y][x].revealed) validMoves.push({ type: 'flip', x, y });
            else if (board[y][x].piece && board[y][x].piece.match(aiColor === 'red' ? /[KABNRPS]/ : /[kabnrps]/)) {
                for (let ty = 0; ty < gridHeight; ty++) {
                    for (let tx = 0; tx < gridWidth; tx++) {
                        if (isValidMoveForAI(x, y, tx, ty, board)) validMoves.push({ type: 'move', fromX: x, fromY: y, toX: tx, toY: ty });
                    }
                }
            }
        }
    }
    if (validMoves.length > 0) {
        let bestMove = null, bestScore = -Infinity;
        for (const move of validMoves) {
            const tempBoard = board.map(row => row.map(c => ({ ...c })));
            if (move.type === 'flip') {
                tempBoard[move.y][move.x].revealed = true;
            } else {
                applyMove(tempBoard, move.fromX, move.fromY, move.toX, move.toY);
            }
            const evalScore = minimax(tempBoard, depth - 1, -Infinity, Infinity, false);
            if (evalScore > bestScore) {
                bestScore = evalScore;
                bestMove = move;
            }
        }
        if (bestMove.type === 'flip') {
            board[bestMove.y][bestMove.x].revealed = true;
            animatePiece(bestMove.x, bestMove.y, bestMove.x, bestMove.y, board[bestMove.y][bestMove.x].piece, () => {
                updateScoreboard();
                updateCapturedList();
                if (!checkGameOver()) {
                    currentPlayer = playerColor;
                    document.getElementById('current-player').textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
                    drawBoard();
                }
            });
        } else {
            const piece = board[bestMove.fromY][bestMove.fromX].piece;
            board[bestMove.fromY][bestMove.fromX] = { piece: '', revealed: false };
            if (board[bestMove.toY][bestMove.toX].piece) {
                if (aiColor === 'red') blackCaptured.push(board[bestMove.toY][bestMove.toX].piece);
                else redCaptured.push(board[bestMove.toY][bestMove.toX].piece);
            }
            board[bestMove.toY][bestMove.toX] = { piece, revealed: true };
            animatePiece(bestMove.fromX, bestMove.fromY, bestMove.toX, bestMove.toY, piece, () => {
                updateScoreboard();
                updateCapturedList();
                if (!checkGameOver()) {
                    currentPlayer = playerColor;
                    document.getElementById('current-player').textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
                    drawBoard();
                }
            });
        }
    } else {
        console.log('AI 無合法移動，遊戲可能結束');
        if (!checkGameOver()) {
            currentPlayer = playerColor;
            document.getElementById('current-player').textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
            drawBoard();
        }
    }
}

function handleMove(e) {
    if (gameOver || (playerColor && currentPlayer !== playerColor)) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellWidth);
    const y = Math.floor((e.clientY - rect.top) / cellHeight);
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

    if (firstMove) {
        if (!board[y][x].revealed) {
            board[y][x].revealed = true;
            const piece = board[y][x].piece;
            playerColor = piece === piece.toUpperCase() ? 'red' : 'black';
            aiColor = playerColor === 'red' ? 'black' : 'red';
            currentPlayer = aiColor; // 第一步翻棋後輪到 AI
            animatePiece(x, y, x, y, piece, () => {
                updateScoreboard();
                updateCapturedList();
                firstMove = false;
                setTimeout(aiMove, 500); // AI 接著行動
            });
        }
    } else if (selectedPiece) {
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x].piece;
            if (board[y][x].piece) {
                if (playerColor === 'red') blackCaptured.push(board[y][x].piece);
                else redCaptured.push(board[y][x].piece);
            }
            board[y][x] = { piece, revealed: true };
            board[selectedPiece.y][selectedPiece.x] = { piece: '', revealed: false };
            animatePiece(selectedPiece.x, selectedPiece.y, x, y, piece, () => {
                updateScoreboard();
                updateCapturedList();
                selectedPiece = null;
                if (!checkGameOver()) {
                    currentPlayer = aiColor;
                    document.getElementById('current-player').textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
                    drawBoard();
                    setTimeout(aiMove, 500);
                }
            });
        } else {
            selectedPiece = null;
            drawBoard();
        }
    } else if (!board[y][x].revealed) {
        board[y][x].revealed = true;
        animatePiece(x, y, x, y, board[y][x].piece, () => {
            updateScoreboard();
            updateCapturedList();
            if (!checkGameOver()) {
                currentPlayer = aiColor;
                document.getElementById('current-player').textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
                drawBoard();
                setTimeout(aiMove, 500);
            }
        });
    } else if (board[y][x].piece && board[y][x].piece.match(playerColor === 'red' ? /[KABNRPS]/ : /[kabnrps]/)) {
        selectedPiece = { x, y };
        drawBoard();
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