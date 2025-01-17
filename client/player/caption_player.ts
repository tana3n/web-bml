import { SVGProvider, SVGProviderOption } from "aribb24.js";
import { VideoPlayer } from "./video_player";

// 別途PESを受け取って字幕を描画する
export class CaptionPlayer extends VideoPlayer {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    superSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    captionOption: SVGProviderOption;
    public constructor(video: HTMLVideoElement, container: HTMLElement) {
        super(video, container);
        this.scale(1);
        this.container.append(this.svg);
        this.container.append(this.superSVG);
        this.captionOption = {
            normalFont: "丸ゴシック",
            forceStrokeColor: "black",
        };
    }

    public setSource(_source: string): void {
    }

    pes: Uint8Array | undefined;
    pts: number | undefined;
    endTime: number | undefined;
    superEndPCR: number | undefined;

    peses: {
        pes: Uint8Array,
        pts: number,
        endTime: number,
    }[] = [];

    pcr: number | undefined;

    public updateTime(pcr: number) {
        this.pcr = pcr;
        if (this.pes != null && this.pts != null && this.endTime != null && this.pcr != null && this.pts + this.endTime < this.pcr) {
            // CS
            this.svg.replaceChildren();
            this.pes = undefined;
            this.pts = undefined;
            this.endTime = undefined;
        }
        if (this.superEndPCR != null && this.superEndPCR < this.pcr) {
            this.superSVG.replaceChildren();
        }
        let pesIndex: number = this.peses.findIndex(x => x.pts > pcr);
        if (pesIndex === -1) {
            pesIndex = this.peses.length;
        }
        if (pesIndex > 0) {
            const pes = this.peses[pesIndex - 1];
            this.pes = pes.pes;
            this.pts = pes.pts;
            this.endTime = pes.endTime;
            if (this.peses.splice(0, pesIndex).find(x => x.pts <= pcr + x.endTime) != null) {
                this.svg.replaceChildren();
            }
            this.render();
        }
    }

    public push(streamId: number, pes: Uint8Array, pts?: number) {
        if (pts != null && streamId === 0xbd) {
            pts /= 90;
            if (this.pcr == null) {
                return;
            }
            const provider: SVGProvider = new SVGProvider(pes, 0);
            const estimate = provider.render({
                ...this.captionOption,
            });
            if (estimate == null) {
                return;
            }
            // 3分以上未受信ならば初期化する(TR-B14 第一分冊7.2.5.1)
            this.peses.push({ pes, pts, endTime: Math.min(Number.isFinite(estimate.endTime) ? estimate.endTime * 1000 : Number.MAX_SAFE_INTEGER, 3 * 60 * 1000) });
            this.peses.sort((a, b) => a.pts - b.pts);
        } else if (streamId ===0xbf) {
            if (this.pcr == null) {
                return;
            }
            const estimate = new SVGProvider(pes, 0).render({
                ...this.captionOption,
                data_identifier: 0x81,
            });
            if (estimate == null) {
                return;
            }
            const svgProvider = new SVGProvider(pes, 0);
            svgProvider.render({
                ...this.captionOption,
                data_identifier: 0x81,
                svg: this.superSVG,
            });
            this.superSVG.style.transform = `scaleY(${this.container.clientHeight / this.superSVG.clientHeight})`;
            this.superSVG.style.transformOrigin = `0px 0px`;
            this.superSVG.style.position = "absolute";
            this.superSVG.style.left = "0px";
            this.superSVG.style.top = "0px";
            this.superEndPCR = this.pcr + Math.min(Number.isFinite(estimate.endTime) ? estimate.endTime * 1000 : Number.MAX_SAFE_INTEGER, 3 * 60 * 1000);
        }
    }

    private render() {
        if (this.pes != null && this.pts != null && this.endTime != null && this.pcr != null) {
            const svgProvider = new SVGProvider(this.pes, this.pts);
            svgProvider.render({
                ...this.captionOption,
                svg: this.svg,
            });
            this.svg.style.transform = `scaleY(${this.container.clientHeight / this.svg.clientHeight})`;
            this.svg.style.transformOrigin = `0px 0px`;
        }
    }

    public showCC(): void {
        this.container.style.display = "";
    }

    public hideCC(): void {
        this.container.style.display = "none";
    }
}
