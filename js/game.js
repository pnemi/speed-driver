import {sprites, SPRITE_TYPE} from './sprites.js';
import {shuffleArray, pickRandomProperty} from "./utils.js";

(function() {

  // tileset image containing all sprites
  const tileset = new Image();
  tileset.src = "img/tileset.png";

  const canvas = document.getElementById("game"); // canvas element
  const ctx = canvas.getContext("2d"); // canvas drawing context

  // canvas dimensions
  const CANVAS_W = 640;
  const CANVAS_H = 960;
  const ASPECT_RATIO = CANVAS_H / CANVAS_W;

  const CANVAS_CX = CANVAS_W / 2;
  const CANVAS_CY = CANVAS_H / 2;

  // dimensions of canvas element for (mobile) scaling
  let canvasElemW = null;
  let canvasElemH = null;

  const SCALE = 2; // scale everything by 2

  const PLAYER_CAR_BOTTOM_OFFSET = 20;
  const OTHER_CARS_SPEED = 100; // absolute multiplicative car speed constant
  const NUM_OF_LANES = 3;
  const LIVES_TOTAL = 3;
  const SCORE_GAIN_PS = 2; // players gets 2 GAME.score per second
  const COLLISION_PROTECTION_TIME = 3000; // x seconds protection since last collision
  const COLLISION_BLINKING_FREQ = 50;
  const CRASH_ANIM_DURATION = 600;
  const NUM_OF_CRASH_SPRITES = 7;
  const CAR_ROTATION_RAD_INC = 1;

  /**
   * Flags to indicate whether car is good, collided recently or has crashed.
   * @type {Object}
   */
  const CAR_CONDITION = {
    NORMAL: 1,
    COLLIDED: 2,
    CRASHED: 3
  };

  let justCollidedWith = null;

  /**
   * Player's car instance.
   * @type {Object}
   */
  const PLAYER = {
    // set init position
    x: CANVAS_CX - (sprites["car"].w * SCALE / 2),
    y: CANVAS_H - (sprites["car"].h * SCALE) - PLAYER_CAR_BOTTOM_OFFSET,
    lastLaneIndex: 1,
    laneIndex: 1, // index of lane
    speed: 200, // car speed or speed of moving road and sideways respectively
    currentSpeed: 200,
    minSpeed: 200,
    maxSpeed: 400,
    isTurning: false,
    turningDir: null,
    turningSpeed: 500, // pixels per second
    lives: LIVES_TOTAL, // 3 tries
    condition: CAR_CONDITION.NORMAL,
    collisionTime: null, // getTimestamp when car collided
    immunityStartTime: null,
    rotation: 0
  };

  /**
   * Game attributes and runtime flags.
   * @type {Object}
   */
  const GAME = {
    rafLoop: null,        // reference to requestAnimationFrame loop
    isPaused: false,
    isGameover: false,
    lastTick: null,       // getTimestamp for last time canvas was rendered
    deltaTime: null,      // delta time since last tick
    score: 0,
    startTime: null,      // getTimestamp when game started
    pauseTime: null,      // getTimestamp for pausing
    obstaclesPerBatch: 3, // number of cars and obstackles per batch
    maxObstacles: 3,
    minObstacles: 5,
    gridCols: 4,
    gridSize: 12,           // grid size (rows * cells)
    gridColSize: 160,      // must not be smaller than cars height
    gridColSizeMin: 160,
    gridColSizeMax: 160,
    lastGrid: [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
  };

  /**
   * Extra empty row prepending before board to place path end for A*.
   * @type {Array}
   */
  const BOARD_PREFIX_ROW = [Array(3).fill(1)];

  /**
   * Extra empty row appending after board to place path start (player's car) for A*.
   * @type {Array}
   */
  const BOARD_SUFFIX_ROW = [Array(3).fill(1)];

  // name bindings for key codes
  const KEY = {
    ARROW_LEFT: 37,
    ARROW_RIGHT: 39,
    R: 82,
    P: 80
  };

  /**
   * Flags to indicate car direction when turning, resp. changing lane.
   * @type {Object}
   */
  const DIR = {
    LEFT: -1,
    RIGHT: 1
  };

  // colors
  const GREEN = "#5AC546";

  // tracks passed road length in order to determine when to generate next obstaclesPool batch
  let passedPX = 0;//-(CANVAS_H / 2);
  let passedPXTotal = passedPX;

  const ROAD_OFFSET = {
    x: sprites["left_sideways_1"].w,
    y: sprites["road"].h
  };

  const LANES_CENTERS = [
    ~~(CANVAS_CX - 105),
    ~~(CANVAS_CX + 5),
    ~~(CANVAS_CX + 105)
  ];

  // x coordinates to align player's car when changing lane
  const PLAYER_CAR_LANES_POS = [
    PLAYER.x - 100,
    PLAYER.x,
    PLAYER.x + 100
  ];

  const SIDEWAYS_OFFSET = {
    LEFT: {
      x: 0,
      y: sprites["left_sideways_1"].h
    },
    RIGHT: {
      x: ROAD_OFFSET.x + sprites["road"].w,
      y: sprites["right_sideways_1"].h
    }
  };

  /**
   * Probabilities of popping up water, tree and field sideway sprites.
   * They are weighted down for more natural and less distracting gameplay.
   * @type {Array}
   */
  const SIDEWAYS_WEIGHTS = [0.45, 0.45, 0.05, 0.05];

  // GAME.score area dimensions
  const SCORE_LABEL = "Score: ";
  const SCORE_FRAME_HORIZONTAL_PADDING = 10; // green GAME.score frame horizontal pad
  const SCORE_FRAME_HEIGHT = 28;
  const SCORE_TOP_OFFSET = 30;
  const SCORE_FRAME_RADIUS = 5;

  // maps traffic sprite type to pool of corresponding sprite names
  const TRAFFIC_SPRITES_POOL = {};

  Object
    .entries(sprites)
    .forEach(o => {
      if ("type" in o[1]) {
         TRAFFIC_SPRITES_POOL[o[0]] = o[1].type;
      };
    });

  /**
   * Cancels animation loop
   */
  const stopAnimLoop = () => window.cancelAnimationFrame(GAME.rafLoop);

  /**
   * Returns timestamp.
   * @return {Number} timestamp
   */
  const getTimestamp = () => window.performance.now();

  // DRAWING
  // –––––––

  // arrays of objects drawn onto canvas
  let roadsPool = [];
  let sidewaysPool = {
    left: [],
    right: []
  };
  let obstaclesPool = [];
  let carsPool = [];

  /**
   * Clears canvas context.
   */
  const clearCanvas = () => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /**
   * Draws sprite by given name and coors.
   * @param  {String} name  property name of sprite in tileset
   * @param  {Number} [x=0] x coordinate to draw at
   * @param  {Number} [y=0] x coordinate to draw at
   */
  const drawTile = (name, x = 0, y = 0) => {
    let tile = sprites[name];
    let sx = tile.x;
    let sy = tile.y;
    let sw = tile.w;
    let sh = tile.h;
    ctx.drawImage(tileset, sx, sy, sw, sh, x, y, Math.round(sw * SCALE), Math.round(sh * SCALE));
  }

  /**
   * Draws objects from roads pool onto canvas context.
   */
  const drawRoad = () => {
    roadsPool.forEach(block => {
      drawTile("road", ROAD_OFFSET.x * SCALE, Math.round(block.y * SCALE));
    });
  }

  /**
   * Draws objects from sideways pool onto canvas context.
   */
  const drawSideways = () => {
    for (let side in sidewaysPool) {
      let xOffset = (side === "left" ?
                     SIDEWAYS_OFFSET.LEFT.x :
                     SIDEWAYS_OFFSET.RIGHT.x);
      sidewaysPool[side].forEach(block => {
        drawTile(`${side}_sideways_${block.index}`, xOffset * SCALE, Math.round(block.y * SCALE));
      })
    }
  }

  /**
   * Draws objects from obstacles pool onto canvas context.
   */
  const drawObstacles = () => {
    obstaclesPool.forEach(o => drawTile(o.sprite, o.x, o.y));
  }

  /**
   * Draws objects from cars pool onto canvas context.
   */
  const drawCars = () => {
    carsPool.forEach(o => drawTile(o.sprite, o.x, o.y));
  }

  /**
   * Draws player sprite based on current car condition.
   */
  const drawPlayerCar = () => {

    ctx.save();

    let tx = PLAYER.x + (sprites["car"].w / 8 * SCALE);
    let ty = PLAYER.y + (sprites["car"].h / 8 * SCALE);

    let x = -(sprites["car"].w / 8 * SCALE);
    let y = -(sprites["car"].h / 8 * SCALE);

    ctx.translate(tx, ty);
    ctx.rotate(PLAYER.rotation * Math.PI / 180);

    if (PLAYER.condition === CAR_CONDITION.NORMAL) {

      drawTile("car", x, y);

    } else if (PLAYER.condition === CAR_CONDITION.COLLIDED) {

      let shouldBlink = Math.floor(Date.now() / COLLISION_BLINKING_FREQ) % 2;

      if (shouldBlink) {
        drawTile("car", x, y);
      }

    } else if (PLAYER.condition === CAR_CONDITION.CRASHED) {


      let timeElapsed = (getTimestamp() - PLAYER.collisionTime);

      if (timeElapsed < CRASH_ANIM_DURATION) {

        let interval = CRASH_ANIM_DURATION / NUM_OF_CRASH_SPRITES;
        let seqNumber = ~~(timeElapsed / interval);
        let sprite = `explosion_${seqNumber}`;

        let expX = x + (((sprites["car"].w / 2) - (sprites[sprite].w / 2)) * SCALE);
        let expY = y + (((sprites["car"].h / 2) - (sprites[sprite].h / 2)) * SCALE);

        if (seqNumber >= 3) {
          drawTile("car_crashed", x, y);
        } else {
          drawTile("car", x, y);
        }
        drawTile(`explosion_${seqNumber}`, expX, expY);

      } else {
        drawTile("car_crashed", x, y);
      }


    }

    ctx.restore();
  }

  /**
   * Draws life indicators onto canvas context.
   */
  const drawLifeIndicators = () => {
    for (let i = 0; i < PLAYER.lives; i++) {
      let y = CANVAS_H - (sprites["life_indicator"].h * SCALE) - (50 * i);
      drawTile("life_indicator", 50, y - PLAYER_CAR_BOTTOM_OFFSET);
    }
  }

  /**
   * Draws score and score label onto canvas.
   */
  const drawScore = () => {

    ctx.save();

    ctx.font = "22px Lato";
    ctx.textBaseline = "top";

    // do not update score anymore once game is over
    if (!GAME.isGameover) {
      GAME.score = Math.max(0, ~~(passedPXTotal / 1000));
    }

    let scoreWidth = ctx.measureText(GAME.score).width;
    let scoreLabelWidth = ctx.measureText(SCORE_LABEL).width;
    let scoreFrameWidth = scoreWidth + (SCORE_FRAME_HORIZONTAL_PADDING * 2);

    let scoreLabelX = CANVAS_CX - ((scoreLabelWidth + scoreFrameWidth) / 2);
    let scoreFrameX = scoreLabelX + scoreLabelWidth;
    let scoreX = scoreFrameX + SCORE_FRAME_HORIZONTAL_PADDING;

    let scoreFrameY = SCORE_TOP_OFFSET;

    ctx.fillStyle = GREEN;

    roundedRect(scoreFrameX, scoreFrameY,
                scoreFrameWidth, SCORE_FRAME_HEIGHT, SCORE_FRAME_RADIUS);

    ctx.fill();

    ctx.fillStyle = "white";

    ctx.fillText(SCORE_LABEL, scoreLabelX, SCORE_TOP_OFFSET);

    ctx.fillText(GAME.score, scoreX, SCORE_TOP_OFFSET);

    ctx.restore();

  }

  /**
   * Calls all other draw functions.
   */
  const draw = () => {

    drawRoad();
    drawSideways();
    drawObstacles();
    drawCars();
    drawPlayerCar();
    drawLifeIndicators();
    drawScore();

  }

  const adjustDifficulty = () => {
    if (!GAME.isGameover) {
      let newSpeed = PLAYER.speed + (0.5 * GAME.deltaTime);
      if (newSpeed <= PLAYER.maxSpeed) {
        PLAYER.speed = newSpeed;
        if (PLAYER.condition !== CAR_CONDITION.COLLIDED) {
          PLAYER.currentSpeed = newSpeed;
        }
      }

      if (GAME.score > 30) {
        GAME.obstaclesPerBatch = GAME.maxObstacles;
      }

    }
  }

  // COLLISIONS
  // ––––––––––

  /**
   * Checks whether there is an overlap between two rectangles (sprites).
   * @param  {String} sprite1 first sprite name
   * @param  {Number} r1x     x coor of first object
   * @param  {Number} r1y     y coor of first object
   * @param  {String} sprite2 second sprite name
   * @param  {Number} r2x     x coor of second object
   * @param  {Number} r2y     y coor of second object
   * @return {Boolean}        true if there is an overlap
   */
  const doesRectOverlap = (sprite1, r1x, r1y, sprite2, r2x, r2y) => {

    let r1w = (sprites[sprite1].w) * SCALE;
    let r1h = (sprites[sprite1].h) * SCALE;

    let r2w = sprites[sprite2].w * SCALE;
    let r2h = sprites[sprite2].h * SCALE;

    return !(r1x + r1w < r2x ||
             r1y + r1h < r2y ||
             r1x > r2x + r2w ||
             r1y > r2y + r2h);

  }

  /**
   * Sets a game environment from aftermath of player collision.
   * Reduces player's life and changes flag of its condition.
   * @return {[type]} [description]
   */
  const playerCollided = () => {

    PLAYER.collisionTime = getTimestamp(); // car collision getTimestamp
    PLAYER.currentSpeed = PLAYER.minSpeed / 6;

    // car collided while in good condition
    if (PLAYER.condition === CAR_CONDITION.NORMAL) {

      PLAYER.condition = CAR_CONDITION.COLLIDED;
      PLAYER.lives--;
      PLAYER.immunityStartTime = getTimestamp();

    }

    // player is not alive
    if (PLAYER.lives <= 0) {
      PLAYER.condition = CAR_CONDITION.CRASHED;
      PLAYER.currentSpeed = 0;
      GAME.isGameover = true;
    }

  }

  /**
   * Checks collisions between player's car and objects from obstacle and
   * cars pool.
   */
  const checkCollisions = () => {
    obstaclesPool.forEach((item, i, arr) => {
      // check only if it hasn't already been hit
      if (!item.wasHit && doesRectOverlap("car", PLAYER.x, PLAYER.y,
                        "obstacle", item.x, item.y)) {
        arr[i].wasHit = true;
        playerCollided();
      }
    });
    carsPool.forEach((item, i, arr) => {
      // check only if it hasn't already been hit
      if (doesRectOverlap("car", PLAYER.x, PLAYER.y,
                        item.sprite, item.x, item.y)) {
        arr[i].wasHit = true;
        justCollidedWith = arr[i];
        if (PLAYER.isTurning && (PLAYER.lastLaneIndex !== justCollidedWith.lane)) {
          if (PLAYER.turningDir === DIR.LEFT) {
            PLAYER.turningDir = DIR.RIGHT;
          } else {
            PLAYER.turningDir = DIR.LEFT;
          }
          PLAYER.laneIndex = PLAYER.lastLaneIndex;
        }
        playerCollided();
      }
    });
  }

  const toMatrix = (arr, width) =>
      arr.reduce((rows, key, index) => (index % width == 0 ? rows.push([key])
        : rows[rows.length-1].push(key)) && rows, []);

  const fixFastVehicles = (board, rowIndex, colIndex) => {
    for (let j = rowIndex; (j >= 0 && j > rowIndex - 2); j--) {
      let type = TRAFFIC_SPRITES_POOL[board[j][colIndex]];
      if (type === SPRITE_TYPE.OBSTACLE ||
          type === SPRITE_TYPE.SLOW_VEHICLE) {
        board[j][colIndex] = null;
      }
    }
  }

  const fixSlowVehicles = (board, rowIndex, colIndex) => {
    if (rowIndex - 1 >= 0) {
    if (TRAFFIC_SPRITES_POOL[board[rowIndex - 1][colIndex]] === SPRITE_TYPE.OBSTACLE) {
        board[rowIndex - 1][colIndex] = null;
      }
    }
  }

  const filterInvalidTraffic = board => {
    for (let rowIndex = board.length - 1; rowIndex >= 0; rowIndex--) {
      for (let colIndex = board[rowIndex].length - 1; colIndex >= 0; colIndex--) {
        let sprite = board[rowIndex][colIndex];
        if (sprite) {
          let type = TRAFFIC_SPRITES_POOL[sprite];
          if (type === SPRITE_TYPE.FAST_VEHICLE) {
            fixFastVehicles(board, rowIndex, colIndex);
          } else if (type === SPRITE_TYPE.SLOW_VEHICLE) {
            fixSlowVehicles(board, rowIndex, colIndex);
          }
        }
      }
    }
  }

  const pickRandomTraffic = () => {
    let result;
    let count = 0;
    for (let prop in TRAFFIC_SPRITES_POOL) {
      if (Math.random() < 1 / ++count) {
        result = prop;
      }
    }
    return result;
  };

  const filterSlowerTraffic = (board, overflows, grid) => {
    let iCurr = board.length - 1, j = 0;
    while (iCurr >= 0) {

      if (board[iCurr] !== null) {

        let rowCurr = ~~(j / NUM_OF_LANES);
        let iAbove = iCurr;
        while (iAbove >= 0) {
          iAbove -= NUM_OF_LANES;
          let rowAbove = ~~((GAME.gridCols - iAbove) / NUM_OF_LANES);
          if (rowCurr + overflows[iCurr] >= rowAbove + overflows[iAbove]) {
            board[iAbove] = null;
          }
        }

        grid[iCurr - (overflows[iCurr] * NUM_OF_LANES)] = 0;

      }

      iCurr -= 1;
      j += 1;
    }
  };

  const createTrafficGraph = board => {
    let i = board.length - 1, j = 0;
    let gridGraph = Array(board.length).fill(1);
    let overflows = Array(board.length);
    while (i >= 0) {

      let sprite = board[i];
      let newIndex = i;
      let overflow = 0;
      overflows[i] = 0;

      // change position only of those cars that has not been moved yet
      if (sprite) {

        // change position only for cars
        if (sprite !== "obstacle") {
          let offset = ~~(j / NUM_OF_LANES);

          // time duration until this grid row will reach player y position level
          let time = (Math.abs(GAME.gridColSize * offset) + PLAYER.y) / PLAYER.currentSpeed;

          // other car's velocity
          let enemySpeed = OTHER_CARS_SPEED * sprites[sprite].speedCoeff;

          // distance traveled by other car by the time this grid row will reach player y position level
          let enemyDistance = enemySpeed * time;

          // other car's y inside its grid row
          let enemyY = (GAME.gridColSize / 2) - (sprites[sprite].h / 2);

          // number of rows other car will travel by the time ...
          overflow = ~~((enemyDistance + enemyY) / GAME.gridColSize);


          // move
          if (overflow > 0) {
            newIndex = i - (overflow * NUM_OF_LANES);
            if (newIndex >= 0) {
            } else {
              // object is too fast
              board[i] = null;
            }
          }

        }

        overflows[i] = overflow;

      }

      i -= 1;
      j += 1;
    }

    filterSlowerTraffic(board, overflows, gridGraph);


    // console.log("OVERFLOWS");
    // console.table(overflows);
    // console.log("GRID A*");
    // console.table(toMatrix(gridGraph, NUM_OF_LANES));

    return gridGraph;
  };

  const genNewBoard = () => {
    let board = Array(GAME.obstaclesPerBatch)
      .fill(0)
      .map(pickRandomTraffic)
      .concat(Array(GAME.gridSize - GAME.obstaclesPerBatch).fill(null));

    shuffleArray(board);
    // board = [
    //   null, null, null,
    //   null, null, null,
    //   null, "blue_truck", null,
    //   null, "yellow_car", null
    // ];

    let grid = toMatrix(createTrafficGraph(board), NUM_OF_LANES);
    // console.log("BOARD AFTER (DRAWING)");
    // console.table(board);

    return {
      newBoard: board,
      newGrid: grid
    };
  }

  /**
   * Generates new batch of obstacles and cars according to given preset.
   * A* graph grid consists of following:
   *    - extra empty row for path end to place in
   *    - newly generated and validated 4x4 matrix board
   *    - 4x4 matrix board from last time
   *    - extra empty row for path start to place in (player's car)
   */
  const placeTraffic = () => {

    let gridWindowHeight = (GAME.gridColSize * SCALE * GAME.gridCols);

    if (passedPX >= gridWindowHeight) {

      let newBoard, newGrid, fullGrid;

      let isValid = false;
      do {
        let generated = genNewBoard();

        newBoard = generated.newBoard;
        newGrid = generated.newGrid;

        fullGrid = BOARD_PREFIX_ROW
          .concat(newGrid)
          .concat(GAME.lastGrid)
          .concat(BOARD_SUFFIX_ROW);

        let graph = new Graph(fullGrid);

        let end = graph.grid[0][1];
        let start = graph.grid[fullGrid.length - 1][1];
        isValid = astar.search(graph, start, end).length;

        // console.log(isValid != 0);

      } while (!isValid);

      GAME.lastGrid = newGrid;

      newBoard.forEach((sprite, i) => {
        if (sprite) {

          let rowIndex = ~~(i / NUM_OF_LANES);
          let laneIndex = i % NUM_OF_LANES;

          let y = (rowIndex * GAME.gridColSize) + (GAME.gridColSize / 2) - (sprites[sprite].h / 2);

          let object = {
            sprite: sprite,
            wasHit: false, // will be true and then removed when car hits obstacle
            lane: laneIndex,
            x: LANES_CENTERS[laneIndex] - (sprites[sprite].w * SCALE / 2),
            // TODO: - gridWindowHeight
            y: y * SCALE - gridWindowHeight  // hide it above out of bounds for now
          };

          if (sprites[sprite].type === SPRITE_TYPE.OBSTACLE) {
            obstaclesPool.push(object);
          } else {
            carsPool.push(object);
          }
        }
      });

      passedPX = 0; // reset counter

    }

  }

  // MOVING
  // ––––––

  /**
   * Generates initial number road blocks at initializing game canvas.
   */
  const initRoad = () => {
    // calc number of road blocks needed to draw on canvas from up to bottom
    let num = Math.ceil(canvas.height / ROAD_OFFSET.y);

    for (let i = 0; i < num; i++) {
      roadsPool.push({
        y: ROAD_OFFSET.y * i
      });
    }
  }

  /**
   * Updates coordinates of road blocks.
   */
  const moveRoad = () => {

    let [firstBlock] = roadsPool;
    let lastBlock = roadsPool[roadsPool.length - 1];

    // do we need to add new road ahead
    if (firstBlock.y >= -PLAYER.currentSpeed) {
      roadsPool.unshift({
        y: -ROAD_OFFSET.y + firstBlock.y
      });
    }

    // can we get rid of road block out of bounds
    if (lastBlock.y > canvas.height) {
      roadsPool.pop();
    }

    roadsPool.forEach((item, i, arr) => {
      arr[i].y += (GAME.deltaTime * PLAYER.currentSpeed);
    });

  }

  /**
   * Generates initial number sideways blocks at initializing game canvas.
   */
  const initSideways = () => {

    for (let side in sidewaysPool) {
      // calc number of road blocks needed to draw on canvas from up to bottom
      let num = Math.ceil(canvas.height / SIDEWAYS_OFFSET.LEFT.y);

      for (let i = 0; i < num; i++) {
        sidewaysPool[side].push({
          y: SIDEWAYS_OFFSET.LEFT.y * i,
          index: getRandomSidewaySpriteIndex()
        });
      }
    }
  }

  /**
   * Updates coordinates of sideways blocks.
   */
  const moveSideways = () => {

    for (let side in sidewaysPool) {
      let [firstBlock] = sidewaysPool[side];
      let lastBlock = sidewaysPool[side][sidewaysPool[side].length - 1];

      // do we need to add new road ahead
      if (firstBlock.y >= -PLAYER.currentSpeed) {
        sidewaysPool[side].unshift({
          y: -SIDEWAYS_OFFSET.LEFT.y + firstBlock.y,
          index: getRandomSidewaySpriteIndex()
        });
      }

      // can we get rid of road block out of bounds
      if (lastBlock.y > canvas.height) {
        sidewaysPool[side].pop();
      }

      sidewaysPool[side].forEach((item, i, arr) => {
        arr[i].y += (GAME.deltaTime * PLAYER.currentSpeed);
      });
    }

  }

  /**
   * Updates coordinates of obstacles.
   */
  const moveObstacles = () => {
    // move obstaclesPool with speed of player's car to simulate they are stationary
    obstaclesPool.forEach((item, i, arr) => {
      arr[i].y += (GAME.deltaTime * PLAYER.currentSpeed * SCALE);
    });
    // clean out of bounds obstaclesPool from drawing pool
    obstaclesPool = obstaclesPool.filter(o => !o.wasHit && !isOutOfVerticalBounds(o.y));
  }

  /**
   * Updates coordinates of cars.
   */
  const moveCars = () => {
    // move obstaclesPool with speed of player's car to simulate they are stationary
    carsPool.forEach((item, i, arr) => {
      let sprite = arr[i].sprite;
      let speed = OTHER_CARS_SPEED * sprites[sprite].speedCoeff;
      arr[i].y += ((PLAYER.currentSpeed - speed) * GAME.deltaTime * SCALE);
    });
    // clean out of bounds obstaclesPool from drawing pool
    carsPool = carsPool.filter(o => !isOutOfVerticalBounds(o.y));
  }

  /**
   * Checks whether currently turning car has already switched lanes or not.
   * @return {Boolean} true if car switched lanes
   */
  const hasCarJoinedNewLane = () => {
    if (PLAYER.turningDir === DIR.LEFT) {
      return PLAYER.x <= PLAYER_CAR_LANES_POS[PLAYER.laneIndex];
    } else if (PLAYER.turningDir === DIR.RIGHT) {
      return PLAYER.x >= PLAYER_CAR_LANES_POS[PLAYER.laneIndex];
    }
    return false;
  }

  const switchLanes = () => {
    let distance = PLAYER.turningSpeed * GAME.deltaTime;

    PLAYER.x += (distance * PLAYER.turningDir);
    PLAYER.rotation += (CAR_ROTATION_RAD_INC * PLAYER.turningDir);

    if (hasCarJoinedNewLane()) { // animation done
      PLAYER.isTurning = false; // is not turning anymore
      PLAYER.turningDir = null; // no actual turning direction
      PLAYER.x = PLAYER_CAR_LANES_POS[PLAYER.laneIndex]; // set position for last frame
    }
  }

  /**
   * Straighten car after switching lane
   */
  const finishTurningRotation = () => {
    if (PLAYER.rotation !== 0) {
      if (PLAYER.rotation < 0) {
        PLAYER.rotation += CAR_ROTATION_RAD_INC;
      } else {
        PLAYER.rotation -= CAR_ROTATION_RAD_INC;
      }
    }
  }

  /**
   * Updates coordinates of player's car.
   */
  const movePlayerCar = () => {

    if (PLAYER.isTurning && !GAME.isGameover) {
      switchLanes();
    } else {
      finishTurningRotation();
    }

    // set normal car condition back to normal after some time
    if (PLAYER.condition === CAR_CONDITION.COLLIDED) {

      let elapsed = (getTimestamp() - PLAYER.collisionTime) / COLLISION_PROTECTION_TIME;

      if (elapsed > 0.4) {
        PLAYER.currentSpeed = PLAYER.speed;
      }

      if (getTimestamp() - PLAYER.immunityStartTime > COLLISION_PROTECTION_TIME) {
        PLAYER.condition = CAR_CONDITION.NORMAL;
        PLAYER.currentSpeed = PLAYER.speed;
      }
    }

    passedPX += (GAME.deltaTime * PLAYER.currentSpeed);
    passedPXTotal += (GAME.deltaTime * PLAYER.currentSpeed);

  }

  /**
   * Calls all other move functions.
   */
  const move = () => {
    moveRoad();
    moveSideways();
    moveObstacles();
    moveCars();
    movePlayerCar();
  }

  // UTILS
  // –––––

  /**
   * Returns whether y coordinate is bigger than canvas height.
   * @param  {Number}  y y coordinate
   * @return {Boolean}   true when y is bigger than height
   */
  const isOutOfVerticalBounds = y => y > CANVAS_H;

  /**
   * Returns weighted random index of new sideway sprite to be drawn on canvas.
   * @return {Number} number between 1 and 4
   */
  const getRandomSidewaySpriteIndex = () => {
    let num = Math.random();
    let s = 0;
    let lastIndex = SIDEWAYS_WEIGHTS.length - 1;

    for (let i = 0; i < lastIndex; ++i) {
      s += SIDEWAYS_WEIGHTS[i];
      if (num < s) {
        return i + 1;
      }
    }

    return lastIndex + 1;
  }

  /**
   * Draws rectangle with radius onto canvas.
   * @param  {Number} x      rectangle x coor
   * @param  {Number} y      rectangle y coor
   * @param  {Number} width  rectangle width
   * @param  {Number} height rectangle height
   * @param  {Number} radius rectangle radius
   */
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

  /**
   * Resizes canvas element to fit either full width or height while preserving
   * aspect ratio and 640px max width/height (no oversizing)
   */
  const resizeCanvas = () => {

    let canvasElemW, canvasElemH;

    if (window.innerHeight < CANVAS_H) {
      canvasElemH = window.innerHeight;
      canvasElemW = canvasElemH / ASPECT_RATIO;
    } else if (window.innerWidth < CANVAS_W) {
      canvasElemW = window.innerWidth;
      canvasElemH = canvasElemW * ASPECT_RATIO;
    }  else {
      canvasElemW = CANVAS_W;
      canvasElemH = CANVAS_H;
    }

    canvas.style.width = canvasElemW + "px";
    canvas.style.height = canvasElemH + "px";

    let pauseScreen = document.getElementsByClassName("pause-screen")[0];
    pauseScreen.style.width = canvasElemW + "px";
    pauseScreen.style.height = canvasElemH + "px";

    let canvasWrapper = document.getElementsByClassName("canvas-wrapper")[0];
    canvasWrapper.style.width = canvasElemW + "px";
    canvasWrapper.style.height = canvasElemH + "px";

  }

  /**
   * Render loop. Clears canvas, moves objects and draws them with new coors.
   * Calculates time delta.
   * @param  {Number} timeNow current timestamp handed by rAF call
   */
  const render = timeNow => {

    clearCanvas();
    placeTraffic();

    move();

    checkCollisions();

    draw();

    adjustDifficulty();


    GAME.deltaTime = (timeNow - GAME.lastTick) / 1000;
    GAME.lastTick = timeNow;

    GAME.rafLoop = window.requestAnimationFrame(render);

  }



  /**
   * Sets player's car flags to indicate switching to the right lane.
   */
  const turnRight = () => {
    if (PLAYER.laneIndex + 1 < NUM_OF_LANES) {
      if (!PLAYER.isTurning) {
        PLAYER.lastLaneIndex = PLAYER.laneIndex;
      }
      PLAYER.isTurning = true;
      PLAYER.turningDir = DIR.RIGHT;
      PLAYER.laneIndex += 1;
    }
  }

  /**
   * Sets player's car flags to indicate switching to the left lane.
   */
  const turnLeft = () => {
    if (PLAYER.laneIndex - 1 >= 0) {
      if (!PLAYER.isTurning) {
        PLAYER.lastLaneIndex = PLAYER.laneIndex;
      }
      PLAYER.isTurning = true;
      PLAYER.turningDir = DIR.LEFT;
      PLAYER.laneIndex -= 1;
    }
  }

  const showPauseScreen = () => {
    let elem = document.getElementsByClassName("pause-screen")[0];
    elem.style.display = "block";
  }

  const hidePauseScreen = () => {
    let elem = document.getElementsByClassName("pause-screen")[0];
    elem.style.display = "none";
  }

  /**
   * Pauses and resumes game loop.
   */
  const pauseGame = () => {
    if (!GAME.isGameover) {
      if (!GAME.isPaused) {
        showPauseScreen();
        GAME.pauseTime = getTimestamp();
        GAME.isPaused = true;
        stopAnimLoop();
      } else {
        hidePauseScreen();
        // shift start time by time game has been GAME.isPaused
        GAME.isPaused = false;
        GAME.lastTick = getTimestamp();
        render(GAME.lastTick);
      }
    }
  }

  /**
   * Refreshes game environment to be ready for a new game.
   */
  const restartGame = () => {
    // stop animation
    stopAnimLoop();

    // clear obstaclesPool and other carsPool from pool
    obstaclesPool = [];
    carsPool = [];
    passedPX = -(CANVAS_H / 2);
    passedPXTotal = passedPX;

    // reset gameplay flags
    GAME.isPaused = false;
    GAME.isGameover = false;
    GAME.score = 0;
    GAME.obstaclesPerBatch = GAME.minObstacles;
    GAME.gridColSize = GAME.gridColSizeMin;

    // reset player flags
    PLAYER.currentSpeed = PLAYER.minSpeed;
    PLAYER.speed = PLAYER.minSpeed;
    PLAYER.isTurning = false;
    PLAYER.turningDir = null;
    PLAYER.lives = LIVES_TOTAL;
    PLAYER.condition = CAR_CONDITION.NORMAL;
    PLAYER.collisionTime = null;
    PLAYER.x = PLAYER_CAR_LANES_POS[PLAYER.laneIndex];

    hidePauseScreen();

    // start a new loop
    GAME.lastTick = getTimestamp();
    render(GAME.lastTick);
  }

  /**
   * Sets initial game environment by generating first batch of sideways and
   * roads blocks.
   */
  const initGame = () => {
    initRoad();
    initSideways();

    GAME.lastTick = getTimestamp();

    render(GAME.lastTick);
  }

  /**
   * Handle arrow keys (computer) controls
   * @param  {Object} event Event object
   */
  const onKeyDown = event => {
    if (event.keyCode === KEY.ARROW_RIGHT) {
      if (PLAYER.condition !== CAR_CONDITION.CRASHED) {
        turnRight();
      }
    } else if (event.keyCode === KEY.ARROW_LEFT) {
      if (PLAYER.condition !== CAR_CONDITION.CRASHED) {
        turnLeft();
      }
    } else if (event.keyCode === KEY.P) {
      pauseGame();
    } else if (event.keyCode === KEY.R) {
      restartGame();
    }
  }

  /**
   * Handle touch (mobile) controls
   * @param  {Object} event Event object
   */
  const onTouchStart = event => {
    let canvasRect = canvas.getBoundingClientRect();
    let x = event.touches[0].clientX - canvasRect.left;


    if (x < parseInt(canvas.style.width, 10) / 2) {
      turnLeft();
    } else {
      turnRight();
    }

  }

  /**
   * Binding listeners
   */

   tileset.addEventListener("load", () => {

     ctx.mozImageSmoothingEnabled = false;
     ctx.webkitImageSmoothingEnabled = false;
     ctx.msImageSmoothingEnabled = false;
     ctx.imageSmoothingEnabled = false;

     canvas.style.width = CANVAS_W + "px";
     canvas.style.height = CANVAS_H + "px";

     resizeCanvas();
     initGame();
   }, false);

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("touchstart", onTouchStart);

  document.getElementById("restart-button")
          .addEventListener("touchend", restartGame);
  document.getElementById("restart-button")
          .addEventListener("click", restartGame);

  document.getElementById("pause-button")
          .addEventListener("touchend", pauseGame);
  document.getElementById("pause-button")
          .addEventListener("click", pauseGame);

  document.getElementById("resume-button")
          .addEventListener("touchend", pauseGame);
  document.getElementById("resume-button")
          .addEventListener("click", pauseGame);

}());
