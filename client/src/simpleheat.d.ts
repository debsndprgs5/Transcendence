declare module 'simpleheat' {
    interface SimpleHeat {
        data(points: [number, number, number][]): SimpleHeat;
        max(max: number): SimpleHeat;
        add(point: [number, number, number]): SimpleHeat;
        clear(): SimpleHeat;
        radius(r: number, blur?: number): SimpleHeat;
        draw(opacity?: number): SimpleHeat;
    }
    function simpleheat(canvas: HTMLCanvasElement): SimpleHeat;
    export default simpleheat;
}