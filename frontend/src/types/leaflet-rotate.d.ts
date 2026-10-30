// leaflet-rotate patches Leaflet in place and ships no type definitions.
declare module "leaflet-rotate";

import "leaflet";

declare module "leaflet" {
  interface MapOptions {
    /** Enables free rotation (and pitch) of the map view. */
    rotate?: boolean;
    /** Initial bearing in degrees, clockwise from north. */
    bearing?: number;
    pitch?: number;
    /** Adds the compass control; an object is passed to it as options. */
    rotateControl?:
      | boolean
      | {
          position?: ControlPosition;
          closeOnZeroBearing?: boolean;
          visualizePitch?: boolean;
        };
    shiftKeyRotate?: boolean;
    touchRotate?: boolean;
    touchPitch?: boolean;
    pitchDrag?: boolean;
    compassBearing?: boolean;
  }

  interface Map {
    /** Handler behind shift-scroll and ctrl-drag rotation. */
    shiftKeyRotate?: { enable(): void; disable(): void };
    setBearing(degrees: number, options?: { animate?: boolean; duration?: number }): this;
    getBearing(): number;
    setPitch(degrees: number, options?: { animate?: boolean; duration?: number }): this;
    getPitch(): number;
    resetNorth(options?: { animate?: boolean; duration?: number }): this;
    resetNorthPitch(options?: { animate?: boolean; duration?: number }): this;
  }
}
