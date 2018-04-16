const SPRITE_TYPE = {
  OBSTACLE: 2,
  FAST_CAR: 3,
  CAR:      4,
  SLOW_CAR: 5,
  TRUCK:    6
}

const sprites = {
  "road": {
    x: 262,
    y: 2,
    w: 169,
    h: 154
  },
  "car": {
    x: 352,
    y: 160,
    w: 40,
    h: 66
  },
  "car_crashed": {
    x: 396,
    y: 174,
    w: 40,
    h: 66
  },
  "obstacle": {
    type: SPRITE_TYPE.OBSTACLE,
    x: 177,
    y: 132,
    w: 48,
    h: 18
  },
  "yellow_car": {
    type: SPRITE_TYPE.FAST_CAR,
    x: 440,
    y: 175,
    w: 40,
    h: 62,
    speedCoeff: 0.8
  },
  "purple_car": {
    type: SPRITE_TYPE.SLOW_CAR,
    x: 352,
    y: 228,
    w: 30,
    h: 46,
    speedCoeff: 0.4
  },
  "green_car": {
    type: SPRITE_TYPE.CAR,
    x: 44,
    y: 452,
    w: 34,
    h: 46,
    speedCoeff: 0.7
  },
  "orange_truck": {
    type: SPRITE_TYPE.TRUCK,
    x: 436,
    y: 88,
    w: 46,
    h: 84,
    speedCoeff: 0.3
  },
  "blue_truck": {
    type: SPRITE_TYPE.TRUCK,
    x: 436,
    y: 0,
    w: 46,
    h: 84,
    speedCoeff: 0.3
  },
  "life_indicator": {
    x: 4,
    y: 456,
    w: 32,
    h: 42
  },
  "left_sideways_1": {
    x: 4,
    y: 134,
    w: 78,
    h: 154
  },
  "left_sideways_2": {
    x: 92,
    y: 134,
    w: 78,
    h: 154
  },
  "left_sideways_3": {
    x: 4,
    y: 294,
    w: 78,
    h: 154
  },
  "left_sideways_4": {
    x: 92,
    y: 294,
    w: 78,
    h: 154
  },
  "right_sideways_1": {
    x: 180,
    y: 162,
    w: 78,
    h: 154
  },
  "right_sideways_2": {
    x: 268,
    y: 162,
    w: 78,
    h: 154
  },
  "right_sideways_3": {
    x: 180,
    y: 322,
    w: 78,
    h: 154
  },
  "right_sideways_4": {
    x: 268,
    y: 322,
    w: 78,
    h: 154
  }
};
export {
  sprites, SPRITE_TYPE
};
