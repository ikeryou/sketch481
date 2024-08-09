import { Bodies, Body, Composite, Composites, Constraint, Engine, Events, Render, Runner } from "matter-js";
import { Conf } from "../core/conf";
import { Func } from "../core/func";
import { MyDisplay } from "../core/myDisplay";
import { Tween } from "../core/tween";
import { Item } from "./item";
import { Rect } from "../libs/rect";
import { Util } from "../libs/util";
import { Point } from "../libs/point";
import { Vector3 } from "three";
import { Val } from "../libs/val";

// -----------------------------------------
//
// -----------------------------------------
export class Contents extends MyDisplay {

  private _id:number;
  private _engine:Engine;
  private _render:Render;
  private _stack:Composite;
  private _stackSize:Rect = new Rect(0,0,120,40);
  private _posBuf: Array<Array<Vector3>> = []
  private _nowPos: number = 0

  private _isHover: boolean = false
  private _items: Array<Item> = []
  private _isStart: boolean = false

  private _isPlaying: boolean = false
  private _hoveRate: Val = new Val(0)
  private _isCheckHover: boolean = false

  constructor(opt:any) {
    super(opt)

    this._id = opt.id

    Tween.set(this.el, {
      width: this._stackSize.width + 'px',
      height: this._stackSize.height + 'px',
    })

    const num = 5
    for(let i = 0; i < num; i++) {
      // 複製する
      const org = document.querySelector('.l-accordion.js-org') as HTMLElement
      const el = org.cloneNode(true) as HTMLElement
      this.el.appendChild(el)
      el.classList.remove('js-org')

      const item = new Item({
        el: el,
        id: i,
      })
      this._items.push(item)

      Tween.set(el, {
        zIndex: num - i,
      })
    }

    if(Conf.IS_TOUCH_DEVICE) {
      this._items[0].el.addEventListener('touchstart', () => {
        if(this._isHover) {
          this._eRollOut()
        } else {
          this._eRollOver()
        }

      })
    } else {
      this._setHover(this._items[0].el)
    }


    const sw = Func.sw();
    const sh = Func.sh();

    // エンジン
    this._engine = Engine.create();
    this._engine.gravity.y = 3;

    // レンダラー
    this._render = Render.create({
      element: document.body,
      engine: this._engine,
      options: {
        width: sw,
        height: sh,
        showAngleIndicator: true,
        showCollisions: true,
        showVelocity: true,
        pixelRatio:Conf.FLG_SHOW_MATTERJS ? 1 : 0.1,
      }
    });
    this._render.canvas.classList.add('js-matter')
    if(!Conf.FLG_SHOW_MATTERJS) {
      this._render.canvas.classList.add('-hide')
    }

    let group = Body.nextGroup(true);

    const startPos = this._getStartPos()

    this._stack = Composites.stack(startPos.x, startPos.y, this._items.length, 1, 0, 0, (x:any, y:any) => {
      return Bodies.rectangle(x, y, this._stackSize.width, this._stackSize.height, {
        collisionFilter: { group: group },
        render:{visible: Conf.FLG_SHOW_MATTERJS}
      });
    });

    Composites.chain(this._stack, 0.5, 0, -0.5, 0, { stiffness: 0.8, length: 0, render: { type: 'line' } });
    Composite.add(this._stack, Constraint.create({
        bodyB: this._stack.bodies[0],
        pointB: { x: 0, y: 0 },
        pointA: { x: this._stack.bodies[0].position.x, y: this._stack.bodies[0].position.y },
        stiffness: 0.8,
    }));

    this._stack.bodies[0].isStatic = true
    this._reset()

    Composite.add(this._engine.world, [
      this._stack,
    ]);

    // run the renderer
    Render.run(this._render);

    // create runner
    const runner:Runner = Runner.create();

    // run the engine
    Runner.run(runner, this._engine);

    // 描画後イベント
    Events.on(this._render, 'afterRender', () => {
      this._eAfterRender();
    })

    this._resize();
  }

  private _start(): void {
    this._stack.bodies.forEach((val,i) => {
      if(i > 0) {
        val.isStatic = false
      }
    })

    document.querySelector(".js-matter")?.classList.add('-hover')
    this._c = 0
  }

  private _getStartPos(): Point {
    const it = this._stackSize.width * 2
    const total = it * (document.querySelectorAll('.l-main-wrapper > div').length) - this._stackSize.width
    const startPos = new Point(it * this._id + Func.sw() * 0.5 - (total * 0.5), 200)
    return startPos
  }

  private _reset(): void {
    const startPos = this._getStartPos()
    this._stack.bodies.forEach((val,i) => {
      if(i > 0) {
        val.isStatic = true
        Body.setPosition(val, {x:startPos.x + this._stackSize.width * 0.5, y:startPos.y + this._stackSize.height * 0.5})
        Body.setAngle(val, Util.radian(180 * i))
      }
    })
  }

  private _eAfterRender(): void {
    // 物理演算結果をパーツに反映
    this._stack.bodies.forEach((val,i) => {
      const item = this._items[i];
      const pos = val.position

      const x = pos.x - this._stackSize.width * 0.5
      const y = pos.y - this._stackSize.height * 0.5
      const rot = Util.degree(val.angle)

      // 位置を記録
      if(this._isHover) {
        Tween.set(item.el, {
          x:x,
          y:y,
          rotationZ:rot,
        })

        if(this._posBuf[i] == undefined) {
          this._posBuf[i] = []
        }
        this._posBuf[i].push(new Vector3(x, y, rot))
      } else {
        if(this._posBuf[i] != undefined) {
          const n = this._posBuf[i][this._nowPos]
          Tween.set(item.el, {
            x:n.x,
            y:n.y,
            rotationZ:n.z,
          })
        } else {
          Tween.set(item.el, {
            x:x,
            y:y,
            rotationZ:rot,
          })
        }
      }
    })

    this._nowPos--
    if(this._nowPos < 0) this._nowPos = 0
  }

  //
  protected _eRollOver() {
    this._isCheckHover = true
    if(this._isPlaying) return

    if(!this._isStart) {
      this._isStart = true
    }

    this._startRollOverMotion()
  }

  //
  private _startRollOverMotion() {
    this._isHover = true
    this._posBuf = []

    this._start()
    this._items[0].addClass('-open')

    this._isPlaying = true
    Tween.a(this._hoveRate, {
      val: [0, 1]
    }, 1, 0, Tween.EaseNone, null, null, () => {
      this._eEndRollOverMotion()
    })
  }

  //
  private _eEndRollOverMotion() {
    this._isPlaying = false
    if(!this._isCheckHover) {
      this._startRollOutMotion()
    }
  }

  //
  protected _eRollOut() {
    this._isCheckHover = false
    if(this._isPlaying) return
  }

  //
  private _startRollOutMotion() {
    this._isHover = false

    this._nowPos = this._posBuf[0].length - 1

    this._reset()
    this._items[0].removeClass('-open')

    this._isPlaying = true
    Tween.a(this._hoveRate, {
      val: [0, 1]
    }, 1, 0, Tween.EaseNone, null, null, () => {
      this._eEndRollOutMotion()
    })
  }

  //
  private _eEndRollOutMotion() {
    this._isPlaying = false
    if(this._isCheckHover) {
      this._startRollOverMotion()
    }
  }

  protected _update():void {
    super._update()
  }

  protected _resize(): void {
    super._resize();

    const sw = Func.sw();
    const sh = Func.sh();

    this._render.canvas.width = sw;
    this._render.canvas.height = sh;

    // this._makeFrame();
  }
}