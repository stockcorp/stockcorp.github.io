const canvas = document.getElementById('xiangqi-board');
const ctx = canvas.getContext('2d');
const gridWidth = 9;  // 寬 9 列（0-8）
const gridHeight = 10; // 高 10 行（0-9）
const cellWidth = (canvas.width - 16) / (gridWidth - 1); // 扣除邊框寬度
const cellHeight = (canvas.height - 16) / (gridHeight - 1); // 扣除邊框高度
let board = [];
let currentPlayer = 'red';
let redScore = 16;
let blackScore = 16;
const stoneSound = document.getElementById('stone-sound');
let selectedPiece = null;
let gameOver = false;
let redCaptured = [];
let blackCaptured = [];

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
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製木紋背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#f0d9b5');
    gradient.addColorStop(1, '#d9b382');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#5a3e2b';
    ctx.lineWidth = 2;

    // 繪製垂直線（考慮邊框偏移）
    const offset = 8; // 邊框寬度
    for (let x = 0; x < gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellWidth + offset, offset);
        ctx.lineTo(x * cellWidth + offset, 4 * cellHeight + offset);
        ctx.moveTo(x * cellWidth + offset, 5 * cellHeight + offset);
        ctx.lineTo(x * cellWidth + offset, canvas.height - offset);
        ctx.stroke();
    }

    // 繪製水平線
    for (let y = 0; y < gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(offset, y * cellHeight + offset);
        ctx.lineTo(canvas.width - offset, y * cellHeight + offset);
        ctx.stroke();
    }

    // 繪製楚河漢界
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(offset, 4 * cellHeight + offset, canvas.width - 2 * offset, cellHeight);
    ctx.fillStyle = '#8b5a2b';
    ctx.font = 'bold 24px "KaiTi", serif';
    ctx.textAlign = 'center';
    ctx.fillText('楚河          漢界', canvas.width / 2, 4.5 * cellHeight + offset);

    // 繪製宮格斜線
    ctx.beginPath();
    ctx.moveTo(3 * cellWidth + offset, offset);
    ctx.lineTo(5 * cellWidth + offset, 2 * cellHeight + offset);
    ctx.moveTo(5 * cellWidth + offset, offset);
    ctx.lineTo(3 * cellWidth + offset, 2 * cellHeight + offset);
    ctx.moveTo(3 * cellWidth + offset, 7 * cellHeight + offset);
    ctx.lineTo(5 * cellWidth + offset, 9 * cellHeight + offset);
    ctx.moveTo(5 * cellWidth + offset, 7 * cellHeight + offset);
    ctx.lineTo(3 * cellWidth + offset, 9 * cellHeight + offset);
    ctx.stroke();

    // 繪製炮與兵的起點標記
    const markers = [
        [1, 2], [7, 2], [1, 7], [7, 7],
        [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
        [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]
    ];
    ctx.fillStyle = '#5a3e2b';
    markers.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x * cellWidth + offset, y * cellHeight + offset, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 繪製棋子
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
        ctx.strokeRect(selectedPiece.x * cellWidth + offset - cellWidth / 2, selectedPiece.y * cellHeight + offset - cellHeight / 2, cellWidth, cellHeight);
    }
}

// 繪製精美棋子
function drawPiece(x, y, piece, opacity = 1) {
    ctx.save();
    const radius = cellWidth * 0.4;
    const centerX = x * cellWidth + 8; // 考慮邊框偏移
    const centerY = y * cellHeight + 8;

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

    ctx.font = 'bold 28px "KaiTi", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = piece.startsWith('r') ? '#e74c3c' : '#000';
    const symbols = {
        'c': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'p': '炮', 's': '兵'
    };
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
    document.getElementById('red-score').textContent = redScore;
    document.getElementById('black-score').textContent = blackScore;
}

// 更新被吃棋子記錄
function updateCapturedList() {
    const symbols = {
        'c': '車', 'n': '馬', 'b': '象', 'a': '士', 'k': '將', 'p': '炮', 's': '兵'
    };
    document.getElementById('red-captured').innerHTML = `紅方被吃：<span>${redCaptured.map(p => symbols[p[1]]).join(', ')}</span>`;
    document.getElementById('black-captured').innerHTML = `黑方被吃：<span>${blackCaptured.map(p => symbols[p[1]]).join(', ')}</span>`;
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

// 檢查移動合法性
function isValidMove(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('r')) return false;
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const target = board[toY][toX];

    if (target && target.startsWith('r')) return false;

    switch (piece[1]) {
        case 'c':
            if (dx !== 0 && dy !== 0) return false;
            return isPathClear(fromX, fromY, toX, toY);
        case 'n':
            if ((dx === 2 && dy === 1) || (dx === 1 && dy === 2)) {
                const blockX = dx === 2 ? fromX + (toX > fromX ? 1 : -1) : fromX;
                const blockY = dy === 2 ? fromY + (toY > fromY ? 1 : -1) : fromY;
                return !board[blockY][blockX];
            }
            return false;
        case 'b':
            if (dx === 2 && dy === 2 && toY <= 4) {
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                return !board[midY][midX];
            }
            return false;
        case 'a':
            if (dx === 1 && dy === 1 && toX >= 3 && toX <= 5 && toY >= 0 && toY <= 2) {
                return true;
            }
            return false;
        case 'k':
            if (dx === 0 && dy === 1 || dx === 1 && dy === 0) {
                return toX >= 3 && toX <= 5 && toY >= 0 && toY <= 2;
            }
            return false;
        case 'p':
            if (dx !== 0 && dy !== 0) return false;
            if (!target) return isPathClear(fromX, fromY, toX, toY);
            const piecesBetween = countPiecesBetween(fromX, fromY, toX, toY);
            return piecesBetween === 1;
        case 's':
            if (fromY <= 4) {
                return dx === 0 && toY === fromY + 1;
            } else {
                return (dx === 0 && toY === fromY + 1) || (dy === 0 && dx === 1);
            }
        default:
            return false;
    }
}

// 檢查路徑是否暢通
function isPathClear(fromX, fromY, toX, toY) {
    if (fromX === toX) {
        const minY = Math.min(fromY, toY);
        const maxY = Math.max(fromY, toY);
        for (let y = minY + 1; y < maxY; y++) {
            if (board[y][fromX]) return false;
        }
    } else if (fromY === toY) {
        const minX = Math.min(fromX, toX);
        const maxX = Math.max(fromX, toX);
        for (let x = minX + 1; x < maxX; x++) {
            if (board[fromY][x]) return false;
        }
    }
    return true;
}

// 計算路徑間棋子數
function countPiecesBetween(fromX, fromY, toX, toY) {
    let count = 0;
    if (fromX === toX) {
        const minY = Math.min(fromY, toY);
        const maxY = Math.max(fromY, toY);
        for (let y = minY + 1; y < maxY; y++) {
            if (board[y][fromX]) count++;
        }
    } else if (fromY === toY) {
        const minX = Math.min(fromX, toX);
        const maxX = Math.max(fromX, toX);
        for (let x = minX + 1; x < maxX; x++) {
            if (board[fromY][x]) count++;
        }
    }
    return count;
}

// AI 移動
function aiMove() {
    if (currentPlayer === 'black' && !gameOver) {
        let blackPieces = [];
        let validMoves = [];

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                if (board[y][x] && board[y][x].startsWith('b')) {
                    blackPieces.push({ x, y });
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
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            const piece = board[move.fromY][move.fromX];
            const target = board[move.toY][move.toX];

            board[move.fromY][move.fromX] = '';
            board[move.toY][move.toX] = piece;

            if (target && target.startsWith('r')) {
                redCaptured.push(target);
            }

            animatePiece(move.fromX, move.fromY, move.toX, move.toY, piece, () => {
                updateScoreboard();
                updateCapturedList();
                if (!checkGameOver()) {
                    currentPlayer = 'red';
                    document.getElementById('current-player').textContent = '紅方';
                    drawBoard();
                }
            });
        }
    }
}

// AI 的移動合法性
function isValidMoveForAI(fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece || !piece.startsWith('b')) return false;
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const target = board[toY][toX];

    if (target && target.startsWith('b')) return false;

    switch (piece[1]) {
        case 'c':
            if (dx !== 0 && dy !== 0) return false;
            return isPathClear(fromX, fromY, toX, toY);
        case 'n':
            if ((dx === 2 && dy === 1) || (dx === 1 && dy === 2)) {
                const blockX = dx === 2 ? fromX + (toX > fromX ? 1 : -1) : fromX;
                const blockY = dy === 2 ? fromY + (toY > fromY ? 1 : -1) : fromY;
                return !board[blockY][blockX];
            }
            return false;
        case 'b':
            if (dx === 2 && dy === 2 && toY >= 5) {
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                return !board[midY][midX];
            }
            return false;
        case 'a':
            if (dx === 1 && dy === 1 && toX >= 3 && toX <= 5 && toY >= 7 && toY <= 9) {
                return true;
            }
            return false;
        case 'k':
            if (dx === 0 && dy === 1 || dx === 1 && dy === 0) {
                return toX >= 3 && toX <= 5 && toY >= 7 && toY <= 9;
            }
            return false;
        case 'p':
            if (dx !== 0 && dy !== 0) return false;
            if (!target) return isPathClear(fromX, fromY, toX, toY);
            const piecesBetween = countPiecesBetween(fromX, fromY, toX, toY);
            return piecesBetween === 1;
        case 's':
            if (fromY >= 5) {
                return dx === 0 && toY === fromY - 1;
            } else {
                return (dx === 0 && toY === fromY - 1) || (dy === 0 && dx === 1);
            }
        default:
            return false;
    }
}

// 玩家移動後觸發 AI
canvas.addEventListener('click', (e) => {
    if (gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - 8) / cellWidth); // 考慮邊框偏移
    const y = Math.round((e.clientY - rect.top - 8) / cellHeight);

    if (currentPlayer !== 'red') return;

    if (!selectedPiece && board[y][x] && board[y][x].startsWith('r')) {
        selectedPiece = { x, y };
        drawBoard();
    } else if (selectedPiece) {
        if (isValidMove(selectedPiece.x, selectedPiece.y, x, y)) {
            const piece = board[selectedPiece.y][selectedPiece.x];
            const target = board[y][x];
            board[selectedPiece.y][selectedPiece.x] = '';
            board[y][x] = piece;

            if (target && target.startsWith('b')) {
                blackCaptured.push(target);
            }

            animatePiece(selectedPiece.x, selectedPiece.y, x, y, piece, () => {
                updateScoreboard();
                updateCapturedList();
                selectedPiece = null;
                if (!checkGameOver()) {
                    currentPlayer = 'black';
                    document.getElementById('current-player').textContent = '黑方';
                    drawBoard();
                    setTimeout(aiMove, 500);
                }
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
    currentPlayer = 'red';
    document.getElementById('current-player').textContent = '紅方';
    selectedPiece = null;
    drawBoard();
    updateScoreboard();
    updateCapturedList();
});

// 初始化
initializeBoard();
drawBoard();
updateScoreboard();
updateCapturedList();
