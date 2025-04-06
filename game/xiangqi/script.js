const canvas = document.getElementById('xiangqi-board');
const ctx = canvas.getContext('2d');
const gridWidth = 9;
const gridHeight = 10;
let borderWidth, cellWidth, cellHeight;
let board = [];
let currentPlayer = 'red';
let redScore = 16;
let blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null;
let gameOver = false;
let redCaptured = [];
let blackCaptured = [];
let difficulty = 'easy';
const EASY_DEPTH = 3; // 簡單模式深度，可手動調整
const HARD_DEPTH = 4; // 困難模式深度，可手動調整

// 動態調整Canvas大小
function resizeCanvas() {
    const containerWidth = document.querySelector('.board-section').offsetWidth;
    const maxWidth = Math.min(containerWidth, 480);
    canvas.width = maxWidth;
    canvas.height = maxWidth * (gridHeight / gridWidth);
    borderWidth = canvas.width * 0.04;
    cellWidth = (canvas.width - 2 * borderWidth) / (gridWidth - 1);
    cellHeight = (canvas.height - 2 * borderWidth) / (gridHeight - 1);
    drawBoard();
}

// 初始化棋盤
function initializeBoard() {
    board = Array(gridHeight).fill().map(() => Array(gridWidth).fill(''));
    board[0][0] = 'rc'; board[0][1] = 'rn'; board[0][2] = 'rb'; board[0][3] = 'ra'; 
    board[0][4] = 'rk'; board[0][5] = 'ra'; board[0][6] = 'rb'; board[0][7] = 'rn'; board[0][8] = 'rc';
    board[2][1] = 'rp'; board[2][7] = 'rp';
    board[3][0] = 'rs'; board[3][2] = 'rs'; board[3][4] = 'rs'; board[3][6] = 'rs'; board[3][8] = 'rs';
    board[9][0] = 'bc'; board[9][1] = 'bn'; board[9][2] = 'bb'; board[9][3] = 'ba'; 
    board[9][4] = 'bk'; board[9][5] = 'ba'; board[9][6] = 'bb'; board[9][7] = 'bn'; board[9][8] = 'bc';
    board[7][1] = 'bp'; board[7][7] = 'bp';
    board[6][0] = 'bs'; board[6][2] = 'bs'; board[6][4] = 'bs'; board[6][6] = 'bs'; board[6][8] = 'bs';
    redScore = 16;
    blackScore = 16;
    gameOver = false;
    redCaptured = [];
    blackCaptured = [];
    updateCapturedList();
    updateDifficultyDisplay();
    updateScoreboard(); // 初始化時更新計分板
    resizeCanvas();
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f0d9b5');
    gradient.addColorStop(1, '#d9b382');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#5a3e2b';
    ctx.lineWidth = 2;

    for (let x = 0; x < gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth + borderWidth, borderWidth);
        ctx.lineTo(x * cellWidth + borderWidth, 4 * cellHeight + borderWidth);
        ctx.moveTo(x * cellWidth + borderWidth, 5 * cellHeight + borderWidth);
        ctx.lineTo(x * cellWidth + borderWidth, canvas.height - borderWidth);
        ctx.stroke();
    }

    for (let y = 0; y < gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(borderWidth, y * cellHeight + borderWidth);
        ctx.lineTo(canvas.width - borderWidth, y * cellHeight + borderWidth);
        ctx.stroke();
    }

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(borderWidth, 4 * cellHeight + borderWidth, canvas.width - 2 * borderWidth, cellHeight);
    ctx.fillStyle = '#8b5a2b';
    ctx.font = `bold ${canvas.width * 0.04}px "KaiTi", serif`;
    ctx.textAlign = 'center';
    ctx.fillText('楚河          漢界', canvas.width / 2, 4.5 * cellHeight + borderWidth);

    ctx.beginPath();
    ctx.moveTo(3 * cellWidth + borderWidth, borderWidth);
    ctx.lineTo(5 * cellWidth + borderWidth, 2 * cellHeight + borderWidth);
    ctx.moveTo(5 * cellWidth + borderWidth, borderWidth);
    ctx.lineTo(3 * cellWidth + borderWidth, 2 * cellHeight + borderWidth);
    ctx.moveTo(3 * cellWidth + borderWidth, 7 * cellHeight + borderWidth);
    ctx.lineTo(5 * cellWidth + borderWidth, 9 * cellHeight + borderWidth);
    ctx.moveTo(5 * cellWidth + borderWidth, 7 * cellHeight + borderWidth);
    ctx.lineTo(3 * cellWidth + borderWidth, 9 * cellHeight + borderWidth);
    ctx.stroke();

    const markers = [
        [1, 2], [7, 2], [1, 7], [7, 7],
        [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
        [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]
    ];
    ctx.fillStyle = '#5a3e2b';
    markers.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * cellWidth + borderWidth, y * cellHeight + borderWidth, canvas.width * 0.01, 0, Math.PI * 2);
        ctx.fill();
    });

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (board[y][x]) {
                drawPiece(x, y, board[y][x], 1);
            }
        }
    }

    if (selectedPiece) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x * cellWidth + borderWidth - cellWidth / 2, selectedPiece.y * cellHeight + borderWidth - cellHeight / 2, cellWidth, cellHeight);
    }
}

// 繪製棋子
function drawPiece(x, y, piece, opacity = 1) {
    ctx.save();
    const radius = Math.min(cellWidth, cellHeight) * 0.35;
    const centerX = x * cellWidth + borderWidth;
    const centerY = y * cellHeight + borderWidth;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = piece.startsWith('r') ? '#f9d5bb' : '#d9d9d9';
    ctx.globalAlpha = opacity;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = piece.startsWith('r') ? '#e74c3c' : '#333';
    ctx.stroke();

    const shadowGradient = ctx.createRadialGradient(centerX - 5, centerY - 5, 0, centerX, centerY, radius);
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGradient;
    ctx.fill();

    ctx.font = `bold ${canvas.width * 0.045}px "KaiTi", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece.startsWith('r') ? '#e74c3c' : '#000';
    const symbols = { 'c': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'p': '炮', 's': '兵' };
    ctx.fillText(symbols[piece[1]], centerX, centerY);

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
    document.getElementById('red-score').textContent = `紅方：${redScore}`;
    document.getElementById('black-score').textContent = `黑方：${blackScore}`;
    const currentPlayerElement = document.getElementById('current-player');
    currentPlayerElement.textContent = `當前玩家：${currentPlayer === 'red' ? '紅方' : '黑方'}`;
    // 動態切換類別
    currentPlayerElement.classList.remove('red', 'black');
    currentPlayerElement.classList.add(currentPlayer === 'red' ? 'red' : 'black');
}

// 更新被吃棋子記錄
function updateCapturedList() {
    const symbols = { 'c': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'p': '炮', 's': '兵' };
    document.getElementById('red-captured').innerHTML = `紅方被吃：<span>${redCaptured.map(p => symbols[p[1]]).join(', ')}</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>${blackCaptured.map(p => symbols[p[1]]).join(', ')}</span>`;
}

// 更新模式顯示
function updateDifficultyDisplay() {
    document.getElementById('difficulty-display').textContent = `模式：${difficulty === 'easy' ? '簡單' : '困難'}`;
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

// 檢查移動合法性（紅方）
function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('r')) return false;
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const target = board[toY][toX];

    if (target && target.startsWith('r')) return false;

    switch (piece[1]) {
        case 'c': return (dx === 0 || dy === 0) && isPathClear(fromX, fromY, toX, toY);
        case 'n': return ((dx === 2 && dy === 1) || (dx === 1 && dy === 2)) && !board[dx === 2 ? fromY + (toY > fromY ? 1 : -1) : fromY][dx === 2 ? fromX : fromX + (toX > fromX ? 1 : -1)];
        case 'b': return dx === 2 && dy === 2 && toY <= 4 && !board[(fromY + toY) / 2][(fromX + toX) / 2];
        case 'a': return dx === 1 && dy === 1 && toX >= 3 && toX <= 5 && toY >= 0 && toY <= 2;
        case 'k': return (dx === 0 && dy === 1 || dx === 1 && dy === 0) && toX >= 3 && toX <= 5 && toY >= 0 && toY <= 2;
        case 'p': return (dx === 0 || dy === 0) && (!target ? isPathClear(fromX, fromY, toX, toY) : countPiecesBetween(fromX, fromY, toX, toY) === 1);
        case 's': return fromY <= 4 ? (dx === 0 && toY === fromY + 1) : ((dx === 0 && toY === fromY + 1) || (dy === 0 && dx === 1));
        default: return false;
    }
}

// 檢查路徑是否暢通
function isPathClear(fromX, fromY, toX, toY) {
    if (fromX === toX) {
        const [minY, maxY] = [Math.min(fromY, toY), Math.max(fromY, toY)];
        for (let y = minY + 1; y < maxY; y++) if (board[y][fromX]) return false;
    } else if (fromY === toY) {
        const [minX, maxX] = [Math.min(fromX, toX), Math.max(fromX, toX)];
        for (let x = minX + 1; x < maxX; x++) if (board[fromY][x]) return false;
    }
    return true;
}

// 計算路徑間棋子數
function countPiecesBetween(fromX, fromY, toX, toY) {
    let count = 0;
    if (fromX === toX) {
        const [minY, maxY] = [Math.min(fromY, toY), Math.max(fromY, toY)];
        for (let y = minY + 1; y < maxY; y++) if (board[y][fromX]) count++;
    } else if (fromY === toY) {
        const [minX, maxX] = [Math.min(fromX, toX), Math.max(fromX, toX)];
        for (let x = minX + 1; x < maxX; x++) if (board[fromY][x]) count++;
    }
    return count;
}

// 評估棋子價值
function getPieceValue(piece) {
    const values = { 'c': 9, 'n': 4, 'b': 2, 'a': 2, 'k': 1000, 'p': 4.5, 's': 1 };
    return piece ? values[piece[1]] || 0 : 0;
}

// 評估位置價值
function getPositionValue(x, y) {
    const redKingPos = { x: 4, y: 0 };
    const distanceToKing = Math.abs(x - redKingPos.x) + Math.abs(y - redKingPos.y);
    const centerValue = Math.abs(x - 4) + Math.abs(y - 4.5);
    let value = 10 - distanceToKing * 0.5 - centerValue * 0.3;
    if (difficulty === 'hard' && y < 5) value += 10;
    return value;
}

// 評估局面
function evaluateBoard(boardState) {
    let score = 0;
    let redKingPos = null;
    let blackKingPos = null;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const piece = boardState[y][x];
            if (piece) {
                const value = getPieceValue(piece);
                const posValue = getPositionValue(x, y);
                if (piece.startsWith('b')) {
                    score += value + posValue;
                    if (piece === 'bk') blackKingPos = { x, y };
                } else {
                    score -= value + posValue;
                    if (piece === 'rk') redKingPos = { x, y };
                }
            }
        }
    }

    if (redKingPos) score += 50 - (Math.abs(redKingPos.x - 4) + redKingPos.y) * 5;
    if (blackKingPos) score += (Math.abs(blackKingPos.x - 4) + (9 - blackKingPos.y)) * 10;

    return score;
}

// Minimax 與 Alpha-Beta 剪枝
function minimax(boardState, depth, alpha, beta, maximizingPlayer) {
    if (depth === 0 || checkGameOverBoard(boardState)) return evaluateBoard(boardState);

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (boardState[y][x] && boardState[y][x].startsWith('b')) {
                    for (let ty = 0; ty < gridHeight; ty++) {
                        for (let tx = 0; tx < gridWidth; tx++) {
                            if (isValidMoveForAI(x, y, tx, ty)) {
                                const tempBoard = boardState.map(row => [...row]);
                                tempBoard[y][x] = '';
                                tempBoard[ty][tx] = boardState[y][x];
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
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (boardState[y][x] && boardState[y][x].startsWith('r')) {
                    for (let ty = 0; ty < gridHeight; ty++) {
                        for (let tx = 0; tx < gridWidth; tx++) {
                            if (isValidMove(x, y, tx, ty)) {
                                const tempBoard = boardState.map(row => [...row]);
                                tempBoard[y][x] = '';
                                tempBoard[ty][tx] = boardState[y][x];
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
        return minEval;
    }
}

// 檢查臨時棋盤是否結束
function checkGameOverBoard(boardState) {
    let redKing = false;
    let blackKing = false;
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (boardState[y][x] === 'rk') redKing = true;
            if (boardState[y][x] === 'bk') blackKing = true;
        }
    }
    return !redKing || !blackKing;
}

// AI 移動
function aiMove() {
    if (currentPlayer !== 'black' || gameOver) return;

    let validMoves = [];
    const depth = difficulty === 'easy' ? EASY_DEPTH : HARD_DEPTH;

    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (board[y][x] && board[y][x].startsWith('b')) {
                for (let ty = 0; ty < gridHeight; ty++) {
                    for (let tx = 0; tx < gridWidth; tx++) {
                        if (isValidMoveForAI(x, y, tx, ty)) {
                            validMoves.push({ fromX: x, fromY: y, toX: tx, toY: ty });
                        }
                    }
                }
            }
        }
    }

    if (validMoves.length > 0) {
        if (difficulty === 'easy') {
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            const piece = board[move.fromY][move.fromX];
            const target = board[move.toY][move.toX];
            board[move.fromY][move.fromX] = '';
            board[move.toY][move.toX] = piece;

            if (target && target.startsWith('r')) redCaptured.push(target);

            animatePiece(move.fromX, move.fromY, move.toX, move.toY, piece, () => {
                updateScoreboard();
                updateCapturedList();
                if (!checkGameOver()) {
                    currentPlayer = 'red';
                    document.getElementById('current-player').textContent = '當前玩家：紅方';
                    drawBoard();
                }
            });
        } else {
            let bestMove = null;
            let bestScore = -Infinity;

            for (const move of validMoves) {
                const tempBoard = board.map(row => [...row]);
                tempBoard[move.fromY][move.fromX] = '';
                tempBoard[move.toY][move.toX] = board[move.fromY][move.fromX];
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

            if (target && target.startsWith('r')) redCaptured.push(target);

            animatePiece(bestMove.fromX, bestMove.fromY, bestMove.toX, bestMove.toY, piece, () => {
                updateScoreboard();
                updateCapturedList();
                if (!checkGameOver()) {
                    currentPlayer = 'red';
                    document.getElementById('current-player').textContent = '當前玩家：紅方';
                    drawBoard();
                }
            });
        }
    }
}

// AI 移動合法性（黑方）
function isValidMoveForAI(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('b')) return false;
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const target = board[toY][toX];

    if (target && target.startsWith('b')) return false;

    switch (piece[1]) {
        case 'c': return (dx === 0 || dy === 0) && isPathClear(fromX, fromY, toX, toY);
        case 'n': return ((dx === 2 && dy === 1) || (dx === 1 && dy === 2)) && !board[dx === 2 ? fromY + (toY > fromY ? 1 : -1) : fromY][dx === 2 ? fromX : fromX + (toX > fromX ? 1 : -1)];
        case 'b': return dx === 2 && dy === 2 && toY >= 5 && !board[(fromY + toY) / 2][(fromX + toX) / 2];
        case 'a': return dx === 1 && dy === 1 && toX >= 3 && toX <= 5 && toY >= 7 && toY <= 9;
        case 'k': return (dx === 0 && dy === 1 || dx === 1 && dy === 0) && toX >= 3 && toX <= 5 && toY >= 7 && toY <= 9;
        case 'p': return (dx === 0 || dy === 0) && (!target ? isPathClear(fromX, fromY, toX, toY) : countPiecesBetween(fromX, fromY, toX, toY) === 1);
        case 's': return fromY >= 5 ? (dx === 0 && toY === fromY - 1) : ((dx === 0 && toY === fromY - 1) || (dy === 0 && dx === 1));
        default: return false;
    }
}

// 處理移動事件
function handleMove(e) {
    if (gameOver || currentPlayer !== 'red') return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.x - rect.left - borderWidth) / cellWidth);
    const y = Math.round((e.y - rect.top - borderWidth) / cellHeight);

    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;

    if (!selectedPiece && board[y][x] && board[y][x].startsWith('r')) {
        selectedPiece = { x, y };
        drawBoard();
    } else if (selectedPiece) {
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            const target = board[y][x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = piece;

            if (target && target.startsWith('b')) blackCaptured.push(target);

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

// 滑鼠和觸控事件
canvas.addEventListener('click', (e) => handleMove({ x: e.clientX, y: e.clientY }));
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove({ x: touch.clientX, y: touch.clientY });
}, { passive: false });

// 重置遊戲
document.getElementById('reset-btn').addEventListener('click', () => {
    initializeBoard();
    currentPlayer = 'red';
    document.getElementById('current-player').textContent = '當前玩家：紅方';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
    updateCapturedList();
});

// 難度選擇
document.getElementById('easy-btn').addEventListener('click', () => {
    difficulty = 'easy';
    initializeBoard();
    currentPlayer = 'red';
    document.getElementById('current-player').textContent = '當前玩家：紅方';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
    updateCapturedList();
    updateDifficultyDisplay();
});

document.getElementById('hard-btn').addEventListener('click', () => {
    difficulty = 'hard';
    initializeBoard();
    currentPlayer = 'red';
    document.getElementById('current-player').textContent = '當前玩家：紅方';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
    updateCapturedList();
    updateDifficultyDisplay();
});

// 視窗大小變化
window.addEventListener('resize', resizeCanvas);

// 初始化
initializeBoard();
drawBoard();
updateScoreboard();
updateCapturedList();
updateDifficultyDisplay();
