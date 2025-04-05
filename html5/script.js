body {
    font-family: 'Arial', sans-serif;
    background: linear-gradient(to bottom, #f0e4c8, #d9c9a3);
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
}

.container {
    text-align: center;
    background: #fff;
    padding: 20px;
    border-radius: 15px;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

h1 {
    color: #333;
    font-size: 2.5em;
    margin-bottom: 10px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.game-area {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.board-container {
    margin-right: 20px;
}

.game-info {
    margin: 10px 0;
    font-size: 1.2em;
}

#current-player {
    font-weight: bold;
    color: #e74c3c;
}

#reset-btn, #ai-btn {
    padding: 10px 20px;
    font-size: 1em;
    margin: 0 10px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
}

#reset-btn:hover, #ai-btn:hover {
    background-color: #2980b9;
}

#go-board {
    background: #d9b382;
    border: 5px solid #8b5a2b;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

/* 計分板樣式 */
.scoreboard {
    background: #2c3e50;
    color: white;
    padding: 20px;
    border-radius: 10px;
    width: 200px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    text-align: left;
}

.scoreboard h2 {
    font-size: 1.5em;
    margin: 0 0 15px 0;
    text-align: center;
    color: #ecf0f1;
}

.score-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    margin: 5px 0;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    font-size: 1.2em;
    transition: transform 0.2s;
}

.score-item:hover {
    transform: scale(1.05);
}

.score-item .player {
    font-weight: bold;
}

.score-item .score {
    background: #e74c3c;
    padding: 5px 10px;
    border-radius: 5px;
}
