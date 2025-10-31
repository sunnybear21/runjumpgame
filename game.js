// Canvas 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 게임 상태
let gameOver = false;
let gameCleared = false;
let score = 0;
let gameStarted = false;
let lives = 3; // 생명 3개

// 난이도 설정
const TARGET_SCORE = 500; // 목표 점수 (집에 도착하는 점수)
let currentSpeed = 5; // 현재 장애물 속도
let currentInterval = 100; // 현재 장애물 생성 간격
const MIN_INTERVAL = 50; // 최소 장애물 간격
const MAX_SPEED = 10; // 최대 속도

// 슬로우 효과
let slowDownActive = false;
let slowDownTimer = 0;
const SLOW_DOWN_DURATION = 300; // 5초 (60fps * 5)

// 캐릭터 설정
const character = {
    x: 100,
    y: 436, // 크기에 맞춰 y 위치 조정 (450 - 64= 436)
    width: 64, // 32 -> 64로 2배 증가
    height: 64, // 32 -> 64로 2배 증가
    velocityY: 0,
    jumpPower: -12,
    minJumpPower: -8, // 최소 점프력 (짧게 누를 때)
    maxJumpPower: -14, // 최대 점프력 (길게 누를 때)
    gravity: 0.5,
    isJumping: false,
    groundY: 436, // 크기에 맞춰 groundY 조정
    invincible: false, // 무적 상태
    invincibleTimer: 0,
    jumpChargeTime: 0 // 점프 충전 시간
};

// 캐릭터 이미지
const characterImgRight = new Image();
characterImgRight.src = './images/char_walk_right.gif';

// 고양이 이미지
const catImg = new Image();
catImg.src = './images/Idle.png';
const catFrameWidth = 32; // 스프라이트 한 프레임 크기
const catFrameHeight = 32;
let catFrame = 0;
let catFrameTimer = 0;

// 장애물 설정
const obstacles = [];
const obstacleWidth = 30;
const obstacleHeight = 50;
let obstacleTimer = 0;
let consecutiveObstacles = 0; // 연속 장애물 카운터
const MAX_CONSECUTIVE_OBSTACLES = 3; // 최대 연속 장애물 수

// 아이템 설정
const items = [];
let itemTimer = 0;
const ITEM_SPAWN_INTERVAL = 500; // 아이템 생성 간격

// 배경 스크롤
let bgScroll = 0;
let currentBgSpeed = 2;

// 키 입력
let spacePressed = false;
let spaceJustPressed = false;

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (!gameStarted && !gameCleared) {
            gameStarted = true;
        }
        if (!gameOver && !gameCleared && !character.isJumping && !spacePressed) {
            spaceJustPressed = true;
            character.jumpChargeTime = 0;
        }
        spacePressed = true;
    }
    if (e.code === 'Enter' && (gameOver || gameCleared)) {
        restartGame();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        spacePressed = false;

        // 스페이스바를 떼면 점프 실행
        if (!gameOver && !gameCleared && !character.isJumping && spaceJustPressed) {
            // 누른 시간에 따라 점프력 결정 (최대 15프레임까지)
            const chargeRatio = Math.min(character.jumpChargeTime / 15, 1);
            character.jumpPower = character.minJumpPower + (character.maxJumpPower - character.minJumpPower) * chargeRatio;
            character.velocityY = character.jumpPower;
            character.isJumping = true;
            spaceJustPressed = false;
        }
    }
});

// 시간대별 하늘 색상 계산
function getSkyColor() {
    if (gameCleared) {
        return '#2C1810'; // 밤 (집에서 고양이와 함께)
    }

    // 점수에 따라 시간대 변화
    if (score < 150) {
        // 낮 (푸른 하늘)
        return '#87CEEB';
    } else if (score < 300) {
        // 오후 (연한 주황)
        const progress = (score - 150) / 150; // 0 ~ 1
        return lerpColor('#87CEEB', '#FFB6A3', progress);
    } else if (score < 450) {
        // 노을 (주황-분홍)
        const progress = (score - 300) / 150; // 0 ~ 1
        return lerpColor('#FFB6A3', '#FF6B9D', progress);
    } else {
        // 저녁 (보라-어두운 파랑)
        const progress = (score - 450) / 50; // 0 ~ 1
        return lerpColor('#FF6B9D', '#4A5568', progress);
    }
}

// 색상 보간 함수
function lerpColor(color1, color2, t) {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);

    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// 시간대 이름 가져오기
function getTimeOfDay() {
    if (score < 150) return '낮';
    if (score < 300) return '오후';
    if (score < 450) return '노을';
    return '저녁';
}

// 난이도 업데이트
function updateDifficulty() {
    // 100점마다 난이도 증가
    const difficultyLevel = Math.floor(score / 100);

    // 속도 증가 (최대 속도까지)
    currentSpeed = Math.min(5 + difficultyLevel * 0.5, MAX_SPEED);

    // 장애물 생성 간격 감소 (최소 간격까지)
    currentInterval = Math.max(100 - difficultyLevel * 10, MIN_INTERVAL);

    // 배경 스크롤 속도도 증가
    currentBgSpeed = Math.min(2 + difficultyLevel * 0.2, 5);
}

// 난이도 레벨 계산
function getDifficultyLevel() {
    return Math.floor(score / 100) + 1;
}

// 아이템 생성
function createItem() {
    const itemTypes = ['heart', 'clock']; // 하트(생명), 시계(슬로우)
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

    items.push({
        x: canvas.width,
        y: 400 - Math.random() * 100, // 공중에 떠있는 아이템
        width: 25,
        height: 25,
        type: randomType
    });
}

// 장애물 생성 (랜덤 간격 포함)
function createObstacle() {
    // 완전 랜덤 높이 (30~90px)
    const minHeight = 30;
    const maxHeight = 90;
    const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    obstacles.push({
        x: canvas.width,
        y: 500 - randomHeight,
        width: obstacleWidth,
        height: randomHeight
    });
}

// 충돌 감지
function checkCollision(char, obj) {
    return char.x < obj.x + obj.width &&
           char.x + char.width > obj.x &&
           char.y < obj.y + obj.height &&
           char.y + char.height > obj.y;
}

// 캐릭터 업데이트
function updateCharacter() {
    // 스페이스바 누르고 있으면 충전 시간 증가
    if (spacePressed && !character.isJumping && spaceJustPressed) {
        character.jumpChargeTime++;
    }

    // 슬로우 효과 중에는 중력도 약간 감소
    const currentGravity = slowDownActive ? character.gravity * 0.7 : character.gravity;

    // 중력 적용
    character.velocityY += currentGravity;
    character.y += character.velocityY;

    // 바닥 체크
    if (character.y >= character.groundY) {
        character.y = character.groundY;
        character.velocityY = 0;
        character.isJumping = false;
    }

    // 무적 시간 감소
    if (character.invincible) {
        character.invincibleTimer--;
        if (character.invincibleTimer <= 0) {
            character.invincible = false;
        }
    }
}

// 아이템 업데이트
function updateItems() {
    // 현재 속도 (슬로우 효과 적용)
    const itemSpeed = slowDownActive ? currentSpeed * 0.3 : currentSpeed;

    // 아이템 이동
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].x -= itemSpeed;

        // 화면 밖으로 나간 아이템 제거
        if (items[i].x + items[i].width < 0) {
            items.splice(i, 1);
            continue;
        }

        // 캐릭터와 아이템 충돌 체크
        if (checkCollision(character, items[i])) {
            const item = items[i];

            if (item.type === 'heart') {
                // 생명 회복 (최대 5개)
                lives = Math.min(lives + 1, 5);
            } else if (item.type === 'clock') {
                // 슬로우 효과 활성화
                slowDownActive = true;
                slowDownTimer = SLOW_DOWN_DURATION;
            }

            items.splice(i, 1);
        }
    }

    // 새 아이템 생성
    if (score < TARGET_SCORE) {
        itemTimer++;
        if (itemTimer > ITEM_SPAWN_INTERVAL) {
            createItem();
            itemTimer = 0;
        }
    }

    // 슬로우 효과 타이머
    if (slowDownActive) {
        slowDownTimer--;
        if (slowDownTimer <= 0) {
            slowDownActive = false;
        }
    }
}

// 장애물 업데이트
function updateObstacles() {
    // 현재 속도 (슬로우 효과 적용)
    const obstacleSpeed = slowDownActive ? currentSpeed * 0.3 : currentSpeed;

    // 장애물 이동
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacleSpeed;

        // 화면 밖으로 나간 장애물 제거 및 점수 증가
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            score += 10;

            // 목표 점수 달성 체크
            if (score >= TARGET_SCORE) {
                gameCleared = true;
            }
        }
    }

    // 새 장애물 생성 (목표 점수 도달 전까지만)
    if (score < TARGET_SCORE) {
        obstacleTimer++;

        // 랜덤 간격 추가 (연속 장애물 생성 제한)
        let randomInterval = currentInterval;
        let shouldCreateFast = false;

        // 연속 장애물이 최대치 미만일 때만 빠른 생성 허용
        if (consecutiveObstacles < MAX_CONSECUTIVE_OBSTACLES && Math.random() < 0.2) {
            // 20%로 확률 낮춤 (기존 30%)
            randomInterval = currentInterval * 0.6; // 0.5 -> 0.6으로 완화
            shouldCreateFast = true;
        }
        // 40% 확률로 느리게 장애물 생성 (여유 시간 제공)
        else if (Math.random() < 0.4) {
            randomInterval = currentInterval * 1.8; // 1.5 -> 1.8로 더 여유롭게
            consecutiveObstacles = 0; // 연속 카운터 리셋
        }

        if (obstacleTimer > randomInterval) {
            createObstacle();
            obstacleTimer = 0;

            if (shouldCreateFast) {
                consecutiveObstacles++;
            } else {
                consecutiveObstacles = 0;
            }
        }
    }
}

// 충돌 체크
function checkCollisions() {
    if (character.invincible) return; // 무적 상태면 충돌 무시

    for (let obs of obstacles) {
        if (checkCollision(character, obs)) {
            lives--;

            if (lives <= 0) {
                gameOver = true;
            } else {
                // 생명이 남아있으면 무적 시간 부여
                character.invincible = true;
                character.invincibleTimer = 120; // 2초 무적
            }
            break;
        }
    }
}

// 별 그리기 (밤 하늘용)
function drawStars() {
    if (score >= 450 || gameCleared) {
        ctx.fillStyle = '#FFFFFF';
        // 고정된 위치에 별 그리기
        for (let i = 0; i < 50; i++) {
            const x = (i * 73) % canvas.width;
            const y = (i * 47) % 300;
            const size = (i % 3) + 1;
            ctx.fillRect(x, y, size, size);
        }
    }
}

// 달 그리기
function drawMoon() {
    if (gameCleared) {
        ctx.fillStyle = '#FFF8DC';
        ctx.beginPath();
        ctx.arc(700, 100, 40, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 배경 그리기
function drawBackground() {
    // 하늘 (시간대별로 색상 변화)
    ctx.fillStyle = getSkyColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 슬로우 효과 시각화
    if (slowDownActive) {
        ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 별과 달 그리기
    drawStars();
    drawMoon();

    // 구름 효과 (낮 시간에만)
    if (score < 400) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 3; i++) {
            const cloudX = ((bgScroll * 0.5) + i * 300) % (canvas.width + 200) - 100;
            ctx.beginPath();
            ctx.arc(cloudX, 80 + i * 50, 30, 0, Math.PI * 2);
            ctx.arc(cloudX + 30, 80 + i * 50, 40, 0, Math.PI * 2);
            ctx.arc(cloudX + 60, 80 + i * 50, 30, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 바닥
    ctx.fillStyle = '#90EE90';
    ctx.fillRect(0, 500, canvas.width, 100);

    // 바닥 선
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width / 50 + 1; i++) {
        const lineX = (i * 50 - bgScroll % 50);
        ctx.beginPath();
        ctx.moveTo(lineX, 500);
        ctx.lineTo(lineX + 10, 510);
        ctx.stroke();
    }
}

// 집 그리기
function drawHouse(x, y) {
    // 집 본체
    ctx.fillStyle = '#D2691E';
    ctx.fillRect(x, y, 80, 60);

    // 지붕
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 40, y - 30);
    ctx.lineTo(x + 90, y);
    ctx.closePath();
    ctx.fill();

    // 문
    ctx.fillStyle = '#654321';
    ctx.fillRect(x + 30, y + 25, 20, 35);

    // 창문 (밤이라 불빛)
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 10, y + 15, 15, 15);
    ctx.fillRect(x + 55, y + 15, 15, 15);

    // 창문 빛 효과
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillRect(x + 8, y + 13, 19, 19);
    ctx.fillRect(x + 53, y + 13, 19, 19);
}

// 고양이 그리기
function drawCat(x, y) {
    // 애니메이션 프레임 업데이트
    catFrameTimer++;
    if (catFrameTimer > 10) { // 10프레임마다 변경
        catFrame = (catFrame + 1) % 10; // 10개 프레임 순환
        catFrameTimer = 0;
    }

    // 고양이 이미지가 로드되었으면 이미지로, 아니면 기본 그래픽으로
    if (catImg.complete) {
        ctx.drawImage(
            catImg,
            catFrame * catFrameWidth, // 스프라이트 시트에서 x 위치
            0, // y 위치 (한 줄이므로 0)
            catFrameWidth,
            catFrameHeight,
            x - 16, // 중앙 정렬
            y - 16,
            catFrameWidth,
            catFrameHeight
        );
    } else {
        // 이미지 로드 전 기본 고양이 그리기
        ctx.fillStyle = '#FF8C42';
        ctx.beginPath();
        ctx.ellipse(x, y, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x - 10, y - 5, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - 13, y - 7, 2, 0, Math.PI * 2);
        ctx.arc(x - 7, y - 7, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 아이템 그리기
function drawItems() {
    for (let item of items) {
        if (item.type === 'heart') {
            // 하트 그리기 (빨간색)
            ctx.fillStyle = '#FF1744';
            ctx.beginPath();
            const x = item.x + item.width / 2;
            const y = item.y + item.height / 2;

            ctx.moveTo(x, y + 5);
            ctx.bezierCurveTo(x, y - 2, x - 10, y - 7, x - 10, y);
            ctx.bezierCurveTo(x - 10, y + 5, x, y + 12, x, y + 15);
            ctx.bezierCurveTo(x, y + 12, x + 10, y + 5, x + 10, y);
            ctx.bezierCurveTo(x + 10, y - 7, x, y - 2, x, y + 5);
            ctx.fill();

            // 테두리
            ctx.strokeStyle = '#C51162';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (item.type === 'clock') {
            // 시계 그리기 (파란색)
            ctx.fillStyle = '#2196F3';
            ctx.beginPath();
            ctx.arc(item.x + item.width / 2, item.y + item.height / 2, 12, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#0D47A1';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 시계 바늘
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            const centerX = item.x + item.width / 2;
            const centerY = item.y + item.height / 2;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX, centerY - 7);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + 5, centerY);
            ctx.stroke();
        }
    }
}

// 캐릭터 그리기
function drawCharacter() {
    // 엔딩 시 캐릭터를 집 앞으로 이동
    let charX = character.x;
    let charY = character.y;

    if (gameCleared) {
        charX = canvas.width - 250;
        charY = 418; // 캐릭터 크기에 맞춰 조정
    }

    // 무적 상태일 때 깜빡임 효과
    if (character.invincible && Math.floor(character.invincibleTimer / 10) % 2 === 0) {
        return; // 일정 간격으로 캐릭터 숨기기
    }

    // 캐릭터 이미지가 로드되었으면 이미지로, 아니면 사각형으로
    if (characterImgRight.complete) {
        ctx.drawImage(
            characterImgRight,
            charX,
            charY,
            character.width,
            character.height
        );
    } else {
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(charX, charY, character.width, character.height);
    }
}

// 장애물 그리기
function drawObstacles() {
    ctx.fillStyle = '#8B4513';
    for (let obs of obstacles) {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // 장애물에 디테일 추가
        ctx.fillStyle = '#654321';
        ctx.fillRect(obs.x + 5, obs.y + 5, obs.width - 10, 5);
        ctx.fillRect(obs.x + 5, obs.y + 15, obs.width - 10, 5);
        ctx.fillStyle = '#8B4513';
    }
}

// 생명 UI 그리기
function drawLives() {
    const heartSize = 20;
    const startX = canvas.width - 150;
    const startY = 30;

    for (let i = 0; i < lives; i++) {
        ctx.fillStyle = '#FF1744';
        ctx.beginPath();
        const x = startX + i * (heartSize + 5);
        const y = startY;

        ctx.moveTo(x + heartSize / 2, y + heartSize * 0.3);
        ctx.bezierCurveTo(x + heartSize / 2, y, x, y - heartSize * 0.3, x, y + heartSize * 0.1);
        ctx.bezierCurveTo(x, y + heartSize * 0.5, x + heartSize / 2, y + heartSize * 0.9, x + heartSize / 2, y + heartSize);
        ctx.bezierCurveTo(x + heartSize / 2, y + heartSize * 0.9, x + heartSize, y + heartSize * 0.5, x + heartSize, y + heartSize * 0.1);
        ctx.bezierCurveTo(x + heartSize, y - heartSize * 0.3, x + heartSize / 2, y, x + heartSize / 2, y + heartSize * 0.3);
        ctx.fill();
    }
}

// UI 그리기
function drawUI() {
    // 점수
    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);

    // 난이도 표시
    ctx.font = '18px Arial';
    ctx.fillText(`Level: ${getDifficultyLevel()}`, 20, 70);

    // 시간대 표시
    ctx.fillText(`시간: ${getTimeOfDay()}`, 20, 95);

    // 목표까지 거리
    const remaining = Math.max(0, TARGET_SCORE - score);
    ctx.fillText(`집까지: ${remaining}`, 20, 120);

    // 생명 표시
    drawLives();

    // 슬로우 효과 표시
    if (slowDownActive) {
        ctx.fillStyle = '#2196F3';
        ctx.font = 'bold 20px Arial';
        const timeLeft = Math.ceil(slowDownTimer / 60);
        ctx.fillText(`⏰ SLOW MODE (${timeLeft}s)`, canvas.width / 2 - 100, 40);
    }

    // 게임 시작 전 안내
    if (!gameStarted) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('집으로 돌아가기', canvas.width / 2, canvas.height / 2 - 100);

        ctx.font = '24px Arial';
        ctx.fillText('고양이가 기다리고 있어요!', canvas.width / 2, canvas.height / 2 - 60);
        ctx.fillText('스페이스바를 눌러 점프!', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText('장애물을 피하세요!', canvas.width / 2, canvas.height / 2 + 30);

        ctx.font = '20px Arial';
        ctx.fillText('❤️ 생명 3개 | 아이템을 먹으세요!', canvas.width / 2, canvas.height / 2 + 70);
        ctx.fillText('❤️ = 생명 회복 | ⏰ = 속도 감소', canvas.width / 2, canvas.height / 2 + 100);

        ctx.font = '18px Arial';
        ctx.fillText(`목표: ${TARGET_SCORE}점 달성`, canvas.width / 2, canvas.height / 2 + 140);
        ctx.fillText('낮 → 오후 → 노을 → 저녁 → 밤', canvas.width / 2, canvas.height / 2 + 165);

        ctx.font = '20px Arial';
        ctx.fillText('스페이스바로 시작', canvas.width / 2, canvas.height / 2 + 205);
        ctx.textAlign = 'left';
    }

    // 게임오버 화면
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);

        ctx.fillStyle = '#FFF';
        ctx.font = '28px Arial';
        ctx.fillText(`Score: ${score} (${getTimeOfDay()})`, canvas.width / 2, canvas.height / 2 + 20);

        ctx.font = '20px Arial';
        ctx.fillText('고양이가 기다리고 있어요...', canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText('Press ENTER to restart', canvas.width / 2, canvas.height / 2 + 100);
        ctx.textAlign = 'left';
    }

    // 게임 클리어 화면
    if (gameCleared) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('집에 도착했어요!', canvas.width / 2, canvas.height / 2 - 100);

        ctx.fillStyle = '#FFF';
        ctx.font = '32px Arial';
        ctx.fillText('고양이와 함께 밤을 보내요', canvas.width / 2, canvas.height / 2 - 50);

        ctx.font = '24px Arial';
        ctx.fillText(`최종 점수: ${score}`, canvas.width / 2, canvas.height / 2 + 10);

        ctx.font = '20px Arial';
        ctx.fillText('Press ENTER to play again', canvas.width / 2, canvas.height / 2 + 60);
        ctx.textAlign = 'left';
    }
}

// 게임 재시작
function restartGame() {
    gameOver = false;
    gameCleared = false;
    score = 0;
    lives = 3;
    gameStarted = false;
    character.y = character.groundY;
    character.velocityY = 0;
    character.isJumping = false;
    character.invincible = false;
    character.invincibleTimer = 0;
    character.jumpChargeTime = 0;
    obstacles.length = 0;
    items.length = 0;
    obstacleTimer = 0;
    itemTimer = 0;
    bgScroll = 0;
    currentSpeed = 5;
    currentInterval = 100;
    currentBgSpeed = 2;
    slowDownActive = false;
    slowDownTimer = 0;
    consecutiveObstacles = 0;
    spacePressed = false;
    spaceJustPressed = false;
}

// 게임 루프
function gameLoop() {
    // 배경 그리기
    drawBackground();

    if (gameStarted && !gameOver && !gameCleared) {
        // 게임 로직 업데이트
        updateCharacter();
        updateObstacles();
        updateItems();
        checkCollisions();
        updateDifficulty();

        // 배경 스크롤
        const scrollSpeed = slowDownActive ? currentBgSpeed * 0.3 : currentBgSpeed;
        bgScroll += scrollSpeed;
        if (bgScroll > canvas.width) {
            bgScroll = 0;
        }
    }

    // 엔딩 화면: 집과 고양이 그리기
    if (gameCleared) {
        drawHouse(canvas.width - 200, 420);
        drawCat(canvas.width - 170, 475);
    }

    // 장애물 그리기
    drawObstacles();

    // 아이템 그리기
    drawItems();

    // 캐릭터 그리기
    drawCharacter();

    drawUI();

    // 다음 프레임
    requestAnimationFrame(gameLoop);
}

// 게임 시작
gameLoop();
