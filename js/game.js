import sprites from './sprites.js';

(function() {

  const tileset = new Image();
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  let animLoop = null;
  let lastTick, deltaTime;

  const WIDTH = 640;
  const HEIGHT = 640;

  const CENTER_X = WIDTH / 2;
  const CENTER_Y = HEIGHT / 2;

  const SCALE = 2;
  const TO_RADIANS = Math.PI / 180;

  const LEFT_SIDEWAYS_X_OFFSET = 0;
  const ROAD_X_OFFSET = sprites["left_sideways_1"].w * SCALE;
  const RIGHT_SIDEWAYS_X_OFFSET = ROAD_X_OFFSET + (sprites["road"].w * SCALE);

  const LEFT_SIDEWAYS_Y_OFFSET = sprites["left_sideways_1"].h * SCALE;
  const ROAD_Y_OFFSET = sprites["road"].h * SCALE;
  const RIGHT_SIDEWAYS_Y_OFFSET = sprites["right_sideways_1"].h * SCALE;

  const SCORE_LABEL = "Score: ";
  const SCORE_FRAME_VERTICAL_PADDING = 8;
  const SCORE_FRAME_HORIZONTAL_PADDING = 10;
  const SCORE_FRAME_HEIGHT = 28;

  const GREEN = "#5AC546";

  let currentWidth = null;
  let currentHeight = null;

  const NUM_OF_LANES = 3;

  // probabilities of popping up water, tree and field sideway
  // sprites are weighted down for more natural and less distracting gameplay
  const SIDEWAYS_PROBABILITIES = [0.45, 0.45, 0.05, 0.05];

  const CAR_BOTTOM_PADDING = 20;

  // flags to indicate car direction when turning, resp. changing lane
  const DIR = {
    LEFT: -1,
    RIGHT: 1
  }

  // flags to indicate whether car is good, collided recently or has crashed
  const PLAYER_STATUS = {
    NORMAL: 1,
    COLLIDED: 2,
    CRASHED: 3
  }

  const SCORE_GAIN = 2; // players gets 2 score per second
  let score = 0;
  let startTime = null;

  const playerCar = {
    // set init position
    x: CENTER_X - (sprites["car"].w * SCALE / 2),
    y: HEIGHT - (sprites["car"].h * SCALE) - CAR_BOTTOM_PADDING,
    laneIndex: 1, // index of lane
    speed: 2, // car speed or speed of moving road and sideways respectively
    isTurning: false,
    turningDir: null,
    turningSpeed: 200 * SCALE, // pixels per second
    lives: 3, // 3 tries
    status: PLAYER_STATUS.NORMAL
  };

  const LANES_OFSSET = 100; // space between lanes

  const LANE_WIDTH = sprites["road"].w / NUM_OF_LANES;
  const LANE_CX = LANE_WIDTH / 2;

  const LANES_CENTERS = [
    ~~LANE_CX,
    ~~(LANE_WIDTH + LANE_CX),
    ~~(LANE_WIDTH * 2 + LANE_CX)
  ];

  const LANES_POS = [
    playerCar.x - 100,
    playerCar.x,
    playerCar.x + 100
  ];

  // filtered other cars pool
  const OTHER_CARS_POOL = Object.values(sprites)
    .filter(s => s.type === "other_car");

  // drawing

  const clearCanvas = () => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
  }

  const drawTile = (name, x = 0, y = 0) => {
    let tile = sprites[name];
    let sx = tile.x;
    let sy = tile.y;
    let sw = tile.w;
    let sh = tile.h;
    ctx.drawImage(tileset, sx, sy, sw, sh, x, y, sw * SCALE, sh * SCALE);
  }

  let roadBlocks = [];
  let sidewaysBlocks = {
    left: [],
    right: []
  };

  const initRoad = () => {
    // calc number of road blocks needed to draw on canvas from up to bottom
    let num = Math.ceil(canvas.height / ROAD_Y_OFFSET);

    for (let i = 0; i < num; i++) {
      roadBlocks.push({
        y: ROAD_Y_OFFSET * i
      });
    }
  }

  const drawRoad = () => {
    roadBlocks.forEach(block => {
      drawTile("road", ROAD_X_OFFSET, block.y);
    })
  }

  const moveRoad = () => {

    let [firstBlock] = roadBlocks;
    let lastBlock = roadBlocks[roadBlocks.length - 1];

    // do we need to add new road ahead
    if (firstBlock.y >= 0) {
      roadBlocks.unshift({
        y: -ROAD_Y_OFFSET + firstBlock.y
      });
    }

    // can we get rid of road block out of bounds
    if (lastBlock.y > canvas.height) {
      roadBlocks.pop();
    }

    roadBlocks.forEach((item, i, arr) => arr[i].y += playerCar.speed);

  }

  const getRandomSidewaySpriteIndex = () => {
    let num = Math.random();
    let s = 0;
    let lastIndex = SIDEWAYS_PROBABILITIES.length - 1;

    for (let i = 0; i < lastIndex; ++i) {
      s += SIDEWAYS_PROBABILITIES[i];
      if (num < s) {
        return i + 1;
      }
    }

    return lastIndex + 1;
  }

  const SIDEWAY_PREFIXES = ["left", "right"];

  const initSideways = () => {

    SIDEWAY_PREFIXES.forEach(side => {
      // calc number of road blocks needed to draw on canvas from up to bottom
      let num = Math.ceil(canvas.height / LEFT_SIDEWAYS_Y_OFFSET);

      for (let i = 0; i < num; i++) {
        sidewaysBlocks[side].push({
          y: LEFT_SIDEWAYS_Y_OFFSET * i,
          index: getRandomSidewaySpriteIndex()
        });
      }
    })
  }

  const drawSideways = () => {
    SIDEWAY_PREFIXES.forEach(side => {
      let xOffset = side === "left" ? LEFT_SIDEWAYS_X_OFFSET : RIGHT_SIDEWAYS_X_OFFSET;
      sidewaysBlocks[side].forEach(block => {
        drawTile(`${side}_sideways_${block.index}`, xOffset, block.y);
      })
    })
  }

  const moveSideways = () => {

    SIDEWAY_PREFIXES.forEach(side => {
      let [firstBlock] = sidewaysBlocks[side];
      let lastBlock = sidewaysBlocks[side][sidewaysBlocks[side].length - 1];

      // do we need to add new road ahead
      if (firstBlock.y >= 0) {
        sidewaysBlocks[side].unshift({
          y: -LEFT_SIDEWAYS_Y_OFFSET + firstBlock.y,
          index: getRandomSidewaySpriteIndex()
        });
      }

      // can we get rid of road block out of bounds
      if (lastBlock.y > canvas.height) {
        sidewaysBlocks[side].pop();
      }

      sidewaysBlocks[side].forEach((item, i, arr) => arr[i].y += playerCar.speed);
    });

  }

  const drawScore = () => {

    ctx.save();

    ctx.font = "22px Lato";
    ctx.textBaseline = "top";

    score = parseInt((performance.now() - startTime) / 1000 * SCORE_GAIN);

    let scoreWidth = ctx.measureText(score).width;
    let scoreLabelWidth = ctx.measureText(SCORE_LABEL).width;
    let scoreFrameWidth = scoreWidth + (SCORE_FRAME_HORIZONTAL_PADDING * 2);

    let scoreLabelX = CENTER_X - ((scoreLabelWidth + scoreFrameWidth) / 2);
    let scoreFrameX = scoreLabelX + scoreLabelWidth;
    let scoreX = scoreFrameX + SCORE_FRAME_HORIZONTAL_PADDING;

    let scoreFrameY = 50;

    ctx.fillStyle = GREEN;

    roundedRect(scoreFrameX, scoreFrameY, scoreFrameWidth, SCORE_FRAME_HEIGHT, 5);
    ctx.fill();

    ctx.fillStyle = "white";

    ctx.fillText(SCORE_LABEL, scoreLabelX, 50);

    ctx.fillText(score, scoreX, 50);

    ctx.restore();

  }

  const drawLifeIndicators = () => {
    for (let i = 0; i < playerCar.lives; i++) {
      let y = canvas.height - (sprites["life_indicator"].h * SCALE) - (50 * i);
      drawTile("life_indicator", 50, y - CAR_BOTTOM_PADDING);
    }
  }

  const drawPlayerCar = () => {



    if (playerCar.status === PLAYER_STATUS.NORMAL) {
      drawTile("car", playerCar.x, playerCar.y);
    } else if (playerCar.status === PLAYER_STATUS.COLLIDED) {

    } else if (playerCar.status === PLAYER_STATUS.CRASHED) {
      drawTile("car_crashed", playerCar.x, playerCar.y);
    }
  }

  const drawBG = () => {

    drawRoad();
    drawSideways();
    drawPlayerCar();
    drawLifeIndicators();
    drawScore();

  }

  const roundedRect = (x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  const resizeCanvas = () => {

    let currentWidth, currentHeight;

    if (window.innerHeight > window.innerWidth) {
      currentWidth = window.innerWidth;
      currentHeight = currentWidth;
    } else {
      currentHeight = window.innerHeight;
      currentWidth = currentHeight;
    }

    canvas.style.width = currentWidth + "px";
    canvas.style.height = currentHeight + "px";

  }

  const setupCanvas = () => {
    resizeCanvas();
  }

  const hasCarJoinedNewLane = () => {
    if (playerCar.turningDir === DIR.LEFT) {
      return playerCar.x < LANES_POS[playerCar.laneIndex];
    } else if (playerCar.turningDir === DIR.RIGHT) {
      return playerCar.x > LANES_POS[playerCar.laneIndex];
    }
    return false;
  }

  const movePlayerCar = timeNow => {

    if (playerCar.isTurning) {

      let distance = playerCar.turningSpeed * deltaTime;

      playerCar.x += (distance * playerCar.turningDir);

      if (hasCarJoinedNewLane()) { // animation done
        lastTick = null;
        playerCar.isTurning = false; // is not turning anymore
        playerCar.turningDir = null; // no actual turning direction
        playerCar.x = LANES_POS[playerCar.laneIndex]; // set position for last frame
      }

    }

  }

  const render = timeNow => {
    clearCanvas();
    moveRoad();
    moveSideways();
    drawBG();

    deltaTime = (timeNow - lastTick) / 1000;

    movePlayerCar(timeNow);

    lastTick = timeNow;
    animLoop = window.requestAnimationFrame(render);
  }

  const initGame = () => {
    setupCanvas();
    initRoad();
    initSideways();

    startTime = performance.now();
    lastTick = performance.now();

    render();
  }

  tileset.addEventListener("load", () => {
    initGame();
  }, false);

  tileset.src = "img/tileset.png";

  const turnRight = () => {
    if (playerCar.laneIndex + 1 < NUM_OF_LANES) {
      playerCar.turningDir = DIR.RIGHT;
      playerCar.laneIndex += 1;
    }
  }

  const turnLeft = () => {
    if (playerCar.laneIndex - 1 >= 0) {
      playerCar.turningDir = DIR.LEFT;
      playerCar.laneIndex -= 1;
    }
  }

  const onKeyDown = event => {
    if (event.keyCode === 39) {
      playerCar.isTurning = true;
      turnRight();
    } else if (event.keyCode === 37) {
      playerCar.isTurning = true;
      turnLeft();
    }
  }

  const onTouchStart = event => {
    let canvasRect = canvas.getBoundingClientRect();
    let x = event.touches[0].clientX - canvasRect.left;

    playerCar.isTurning = true;

    if (x < parseInt(canvas.style.width) / 2) {
      turnLeft();
    } else {
      turnRight();
    }
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("touchstart", onTouchStart);

}());
