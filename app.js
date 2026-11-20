/* KeyTree — App.jsx를 브라우저용으로 변환한 파일 (React 18 전역 사용) */
(function () {
"use strict";
var _R = React, useCallback = _R.useCallback, useEffect = _R.useEffect, useMemo = _R.useMemo, useRef = _R.useRef, useState = _R.useState;

/* ============================================================
 * KeyTree v6 — AI 비전 수목 동정 PWA (단일 App.jsx)
 * ------------------------------------------------------------
 * 흐름: 사진 업로드 → AI 판독(형질·부위·후보) → 자동 동정 → 도감 비교 → 검색표 경로
 *
 * [필수: 서버 프록시]
 *  - 브라우저에 API 키를 둘 수 없으므로 POST VISION_API_URL(/api/vision)을
 *    처리하는 서버가 반드시 필요합니다. 함께 제공된 vision-proxy.js 를 쓰거나
 *    같은 계약(요청 {messages,max_tokens} → Anthropic Messages API 응답)을 구현하세요.
 *  - 개발 서버(Vite)에서는 vite.config 의 server.proxy 로 /api 를 프록시 서버에 연결하세요.
 *  - 프록시가 없으면 404 → 화면에 원인이 안내되고 "다시 시도"가 나옵니다.
 *
 * [데이터]
 *  - 학명·과는 KPNI 체계를 따르되 배포 전 최신 국명/학명을 재확인하세요.
 *  - keyPath는 산림청 검색표 논리를 반영한 간이 예시이며 공식 원문이 아닙니다.
 *  - 도감 이미지는 REF_IMG_BASE/{id}_{leaf|bark|fruit}.jpg 규칙입니다.
 *    라이선스가 확인된 이미지를 두거나 images 값을 직접 교체하세요.
 *    없으면 식물 모양 SVG 대체 이미지가 표시됩니다.
 * ============================================================ */
const VISION_API_URL = "/api/vision";
const VISION_TIMEOUT_MS = 40000;
const MAX_IMAGE_SIDE = 1024;
const MAX_CONCURRENT = 2; // 동시에 보내는 분석 요청 수 (호출 한도 보호)
const REF_IMG_BASE = "/ref";
const ref = (id) => ({
    leaf: `${REF_IMG_BASE}/${id}_leaf.jpg`,
    bark: `${REF_IMG_BASE}/${id}_bark.jpg`,
    fruit: `${REF_IMG_BASE}/${id}_fruit.jpg`,
});
const AI_SELECT_THRESHOLD = 0.5;
const LOW_MATCH_THRESHOLD = 60;
const CLOSE_GAP = 8;
const MAX_PHOTOS = 8;
const MAX_FILE_MB = 15;
const PARTS = {
    leaf: { label: "잎", art: "leaf" },
    bark: { label: "수피", art: "bark" },
    fruit: { label: "열매·기타", art: "fruit" },
};
const TRAIT_GROUPS = [
    { id: "arr", label: "잎차례", part: "leaf", w: 2, opts: { alt: "어긋나기", opp: "마주나기" } },
    { id: "form", label: "잎 형태", part: "leaf", w: 3, opts: { simple: "홑잎", compound: "깃꼴겹잎", fan: "부채꼴" } },
    { id: "margin", label: "잎 가장자리", part: "leaf", w: 2, opts: { entire: "밋밋함", serrate: "톱니", wavy: "물결모양 톱니", lobed: "결각(갈래)" } },
    { id: "bark", label: "수피", part: "bark", w: 2, opts: { smooth: "매끈함", shallow: "얕게 갈라짐", deep: "깊게 갈라짐", flaking: "비늘처럼 벗겨짐" } },
    { id: "fruit", label: "열매", part: "fruit", w: 3, opts: { samara: "시과(날개열매)", acorn: "견과(도토리)", capsule: "삭과", cone: "솔방울 모양", drupe: "핵과·육질 종자" } },
];
const groupOf = (id) => TRAIT_GROUPS.find((g) => g.id === id);
const LABEL = (g, v) => { var _a, _b; return (_b = (_a = groupOf(g)) === null || _a === void 0 ? void 0 : _a.opts[v]) !== null && _b !== void 0 ? _b : v; };
const K = (q, a, g, v) => ({ q, a, g, v });
/* ---------------- 내장 데이터베이스 ---------------- */
const TREE_DATABASE = [
    {
        id: "ailanthus", name: "가죽나무", sci: "Ailanthus altissima (Mill.) Swingle", family: "소태나무과",
        traits: { arr: ["alt"], form: ["compound"], margin: ["entire"], bark: ["shallow"], fruit: ["samara"] },
        features: ["큰 깃꼴겹잎(작은잎 13~25개)", "작은잎 밑부분에 큰 톱니 1~2쌍과 선점이 있음", "잎·가지를 비비면 특유의 냄새", "프로펠러형 시과가 무리 지어 달림"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "어긋나기", "arr", "alt"),
            K("잎이 홑잎인가, 겹잎인가?", "깃꼴겹잎", "form", "compound"),
            K("작은잎 가장자리는?", "대체로 밋밋, 밑부분에만 큰 톱니·선점", "margin", "entire"),
            K("열매의 형태는?", "시과(날개열매)", "fruit", "samara"),
            K("수피는?", "회갈색, 얕게 갈라짐", "bark", "shallow"),
        ],
        images: ref("ailanthus"),
    },
    {
        id: "alnus", name: "물오리나무", sci: "Alnus sibirica Fisch. ex Turcz.", family: "자작나무과",
        traits: { arr: ["alt"], form: ["simple"], margin: ["serrate", "lobed"], bark: ["smooth"], fruit: ["cone"] },
        features: ["잎은 넓은 달걀형, 가장자리가 얕게 갈라지고 잔톱니", "잎 양면에 털이 있고 뒷면은 연한 녹색", "작은 솔방울 모양 열매(구과상 열매)", "수피는 회갈색으로 비교적 매끈"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "어긋나기", "arr", "alt"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리는?", "얕은 결각 + 잔톱니", "margin", "lobed"),
            K("열매의 형태는?", "솔방울 모양의 작은 열매", "fruit", "cone"),
            K("수피는?", "회갈색, 비교적 매끈", "bark", "smooth"),
        ],
        images: ref("alnus"),
    },
    {
        id: "mongolica", name: "신갈나무", sci: "Quercus mongolica Fisch. ex Ledeb.", family: "참나무과 (참나무속)",
        traits: { arr: ["alt"], form: ["simple"], margin: ["wavy"], bark: ["deep"], fruit: ["acorn"] },
        features: ["잎자루가 거의 없고 잎 밑이 귀 모양", "가장자리가 물결 모양의 둔한 톱니", "수피는 세로로 깊게 갈라짐", "도토리 깍정이 비늘이 작고 납작함"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "어긋나기", "arr", "alt"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리와 잎자루는?", "물결 모양 톱니, 잎자루 매우 짧음", "margin", "wavy"),
            K("열매의 형태는?", "견과(도토리)", "fruit", "acorn"),
            K("수피는?", "세로로 깊게 갈라짐", "bark", "deep"),
        ],
        images: ref("mongolica"),
    },
    {
        id: "acutissima", name: "상수리나무", sci: "Quercus acutissima Carruth.", family: "참나무과 (참나무속)",
        traits: { arr: ["alt"], form: ["simple"], margin: ["serrate"], bark: ["deep"], fruit: ["acorn"] },
        features: ["잎 가장자리 톱니 끝이 바늘처럼 뾰족(침형 톱니)", "잎은 밤나무 잎과 비슷한 긴 타원형", "도토리 깍정이 비늘이 길게 뒤로 젖혀짐", "수피는 깊게 갈라지고 코르크층이 발달"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "어긋나기", "arr", "alt"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리 톱니는?", "침 모양의 뾰족한 톱니", "margin", "serrate"),
            K("열매의 형태는?", "견과(도토리), 깍정이 비늘이 젖혀짐", "fruit", "acorn"),
            K("수피는?", "깊게 갈라지고 코르크질", "bark", "deep"),
        ],
        images: ref("acutissima"),
    },
    {
        id: "forsythia", name: "개나리", sci: "Forsythia koreana (Rehder) Nakai", family: "물푸레나무과",
        traits: { arr: ["opp"], form: ["simple"], margin: ["serrate"], bark: ["smooth"], fruit: ["capsule"] },
        features: ["잎이 마주나며 가장자리 윗부분에 톱니", "가지 속이 마디를 제외하고 비어 있음(중공)", "이른 봄 잎보다 먼저 노란 꽃", "열매는 삭과"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "마주나기", "arr", "opp"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리는?", "윗부분에 톱니", "margin", "serrate"),
            K("열매의 형태는?", "삭과", "fruit", "capsule"),
            K("줄기·수피는?", "회갈색, 피목 발달, 가지 속이 빔", "bark", "smooth"),
        ],
        images: ref("forsythia"),
    },
    {
        id: "zelkova", name: "느티나무", sci: "Zelkova serrata (Thunb.) Makino", family: "느릅나무과",
        traits: { arr: ["alt"], form: ["simple"], margin: ["serrate"], bark: ["flaking"], fruit: ["drupe"] },
        features: ["잎맥이 뚜렷하고 측맥 끝이 톱니로 이어짐", "잎 가장자리에 규칙적인 톱니", "수피가 비늘처럼 벗겨지며 무늬가 생김", "열매는 일그러진 납작한 구형(핵과)"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "어긋나기", "arr", "alt"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리는?", "측맥 끝이 톱니로 연결되는 규칙적 톱니", "margin", "serrate"),
            K("열매의 형태는?", "일그러진 납작한 핵과", "fruit", "drupe"),
            K("수피는?", "회갈색, 비늘처럼 벗겨짐", "bark", "flaking"),
        ],
        images: ref("zelkova"),
    },
    {
        id: "ginkgo", name: "은행나무", sci: "Ginkgo biloba L.", family: "은행나무과",
        traits: { arr: ["alt"], form: ["fan"], margin: ["lobed"], bark: ["deep"], fruit: ["drupe"] },
        features: ["부채꼴 잎, 끝이 2갈래로 갈라지기도 함", "잎맥이 두 갈래로 갈라지는 차상맥", "암수딴그루, 종자는 육질 외종피(악취)", "수피는 회갈색으로 세로로 깊게 갈라짐"],
        keyPath: [
            K("잎 모양이 일반적인 잎인가, 특수한 형태인가?", "부채꼴(특수형)", "form", "fan"),
            K("잎차례는?", "어긋나기(단지에서는 모여나기)", "arr", "alt"),
            K("잎 끝 가장자리는?", "중앙이 갈라지거나 파상", "margin", "lobed"),
            K("종자의 형태는?", "육질 외종피를 가진 핵과 모양", "fruit", "drupe"),
            K("수피는?", "세로로 깊게 갈라짐", "bark", "deep"),
        ],
        images: ref("ginkgo"),
    },
    {
        id: "pictum", name: "고로쇠나무", sci: "Acer pictum Thunb.", family: "무환자나무과 (단풍나무속)",
        traits: { arr: ["opp"], form: ["simple"], margin: ["lobed"], bark: ["shallow"], fruit: ["samara"] },
        features: ["잎이 마주나며 5~7갈래로 얕게 갈라짐", "결각 가장자리는 밋밋한 편", "봄에 수액을 채취", "수평으로 벌어진 날개를 가진 시과"],
        keyPath: [
            K("잎이 마주나는가, 어긋나는가?", "마주나기", "arr", "opp"),
            K("잎이 홑잎인가, 겹잎인가?", "홑잎", "form", "simple"),
            K("잎 가장자리는?", "5~7갈래로 갈라지는 결각", "margin", "lobed"),
            K("열매의 형태는?", "시과(날개가 거의 수평)", "fruit", "samara"),
            K("수피는?", "회갈색, 세로로 얕게 갈라짐", "bark", "shallow"),
        ],
        images: ref("pictum"),
    },
];
/* ---------------- 분류 체계 (계·문·강·목·과·속·종) ----------------
 * 주의: 도감 책에는 과·학명까지만 있어 계~목은 일반적인 APG 기반 표기를 넣은 것입니다.
 * 계는 식물계, 문은 모두 관속식물문으로 두고 강에서 침엽수/은행/피자식물을 나눴습니다.
 * 배포 전 KPNI(국가표준식물목록)와 대조해 확정하세요. */
const KINGDOM = ["식물계", "Plantae"];
const PHYLUM = ["관속식물문", "Tracheophyta"];
const ANGIO = ["목련강", "Magnoliopsida"];
const TAXONOMY = {
    ailanthus: { cls: ANGIO, ord: ["무환자나무목", "Sapindales"], fam: ["소태나무과", "Simaroubaceae"], gen: ["가죽나무속", "Ailanthus"], sp: ["가죽나무", "Ailanthus altissima"] },
    alnus: { cls: ANGIO, ord: ["참나무목", "Fagales"], fam: ["자작나무과", "Betulaceae"], gen: ["오리나무속", "Alnus"], sp: ["물오리나무", "Alnus sibirica"] },
    mongolica: { cls: ANGIO, ord: ["참나무목", "Fagales"], fam: ["참나무과", "Fagaceae"], gen: ["참나무속", "Quercus"], sp: ["신갈나무", "Quercus mongolica"] },
    acutissima: { cls: ANGIO, ord: ["참나무목", "Fagales"], fam: ["참나무과", "Fagaceae"], gen: ["참나무속", "Quercus"], sp: ["상수리나무", "Quercus acutissima"] },
    forsythia: { cls: ANGIO, ord: ["꿀풀목", "Lamiales"], fam: ["물푸레나무과", "Oleaceae"], gen: ["개나리속", "Forsythia"], sp: ["개나리", "Forsythia koreana"] },
    zelkova: { cls: ANGIO, ord: ["장미목", "Rosales"], fam: ["느릅나무과", "Ulmaceae"], gen: ["느티나무속", "Zelkova"], sp: ["느티나무", "Zelkova serrata"] },
    ginkgo: { cls: ["은행나무강", "Ginkgoopsida"], ord: ["은행나무목", "Ginkgoales"], fam: ["은행나무과", "Ginkgoaceae"], gen: ["은행나무속", "Ginkgo"], sp: ["은행나무", "Ginkgo biloba"] },
    pictum: { cls: ANGIO, ord: ["무환자나무목", "Sapindales"], fam: ["무환자나무과", "Sapindaceae"], gen: ["단풍나무속", "Acer"], sp: ["고로쇠나무", "Acer pictum"] },
};
const RANK_ROWS = (id) => {
    const t = TAXONOMY[id];
    if (!t)
        return [];
    return [["계", "Kingdom", KINGDOM], ["문", "Phylum", PHYLUM], ["강", "Class", t.cls], ["목", "Order", t.ord], ["과", "Family", t.fam], ["속", "Genus", t.gen], ["종", "Species", t.sp]];
};
/* ============================================================
 * 비전 AI 엔진: 사진 → (부위, 형질 확률, 후보 수종, 판독 메모)
 * 서버 프록시(VISION_API_URL)를 통해 멀티모달 모델을 호출합니다.
 * ============================================================ */
class VisionError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const buildPrompt = () => `You are the vision module of a Korean woody-plant identification app used by educators and researchers.
Examine the photo and answer with ONE JSON object only (no markdown, no prose).
Schema:
{"is_plant":boolean,"part":"leaf|bark|fruit|other","quality":"good|poor","traits":{"<group>":{"<value>":<probability 0..1>}},"candidates":[{"id":"<species id>","p":<0..1>}],"note":"한국어 1~2문장: 사진에서 보이는 진단 형질 근거"}
Rules:
- "traits": include a group ONLY if it is actually judgeable from THIS photo; omit the others. Probabilities inside a group must sum to at most 1.
- "candidates": at most 3 species from the closed list below, only when visible features genuinely support them; otherwise []. Never invent ids.
- Be conservative: lower probabilities when the photo is blurry, partial, or ambiguous.
- If the photo is not a plant, set is_plant=false, traits={} and candidates=[].
Trait groups and allowed values:
${TRAIT_GROUPS.map((g) => `- ${g.id} (${g.label}): ${Object.entries(g.opts).map(([v, l]) => `${v}=${l}`).join(", ")}`).join("\n")}
Closed species list:
${TREE_DATABASE.map((t) => `- ${t.id}: ${t.name} (${t.sci})`).join("\n")}`;
/** 업로드 이미지를 최대 MAX_IMAGE_SIDE px JPEG(base64)로 축소 */
const toJpegBase64 = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
        try {
            const s = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            const c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.naturalWidth * s));
            c.height = Math.max(1, Math.round(img.naturalHeight * s));
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
        }
        catch (e) {
            reject(new VisionError("IMAGE", "사진을 처리하지 못했어요."));
        }
    };
    img.onerror = () => reject(new VisionError("IMAGE", "사진을 열 수 없어요. JPG·PNG 형식으로 시도해 주세요."));
    img.src = url;
});
const extractJson = (text) => {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a < 0 || b <= a)
        throw new Error("no json");
    return JSON.parse(text.slice(a, b + 1));
};
/** 응답 검증: 알려진 그룹·값·수종 id만 남기고 확률을 0~1로 제한 */
function sanitize(out) {
    const traits = {};
    TRAIT_GROUPS.forEach((g) => {
        const raw = out && out.traits && out.traits[g.id];
        if (!raw || typeof raw !== "object")
            return;
        Object.keys(g.opts).forEach((v) => {
            const p = Number(raw[v]);
            if (Number.isFinite(p) && p > 0) {
                traits[g.id] = traits[g.id] || {};
                traits[g.id][v] = Math.min(1, p);
            }
        });
    });
    const candidates = (Array.isArray(out === null || out === void 0 ? void 0 : out.candidates) ? out.candidates : [])
        .map((c) => ({ id: c === null || c === void 0 ? void 0 : c.id, p: Math.min(1, Number(c === null || c === void 0 ? void 0 : c.p)) }))
        .filter((c) => TREE_DATABASE.some((t) => t.id === c.id) && Number.isFinite(c.p) && c.p > 0);
    return {
        isPlant: (out === null || out === void 0 ? void 0 : out.is_plant) !== false,
        part: ["leaf", "bark", "fruit"].includes(out === null || out === void 0 ? void 0 : out.part) ? out.part : "fruit", // other → 열매·기타
        quality: (out === null || out === void 0 ? void 0 : out.quality) === "poor" ? "poor" : "good",
        traits,
        candidates,
        note: typeof (out === null || out === void 0 ? void 0 : out.note) === "string" ? out.note.slice(0, 200) : "",
    };
}
function httpError(status) {
    if (status === 404 || status === 405)
        return new VisionError("NO_PROXY", `AI 분석 서버(${VISION_API_URL})를 찾을 수 없어요. 서버에 프록시가 설정돼 있는지 확인해 주세요.`);
    if (status === 401 || status === 403)
        return new VisionError("AUTH", "AI 서버 인증에 문제가 있어요. 서버의 API 키 설정을 확인해 주세요.");
    if (status === 413)
        return new VisionError("TOO_LARGE", "사진 용량이 서버 한도를 넘었어요. 더 작은 사진으로 시도해 주세요.");
    if (status === 429)
        return new VisionError("RATE_LIMIT", "요청이 많아 잠시 제한됐어요. 1분쯤 뒤에 다시 시도해 주세요.");
    if (status === 503 || status === 529)
        return new VisionError("BUSY", "AI 서버가 혼잡해요. 잠시 후 다시 시도해 주세요.");
    return new VisionError("SERVER", `AI 서버 오류가 발생했어요 (${status}). 잠시 후 다시 시도해 주세요.`);
}
/** base64 JPEG 한 장을 프록시로 보내 판독 결과를 받음 (일시적 오류는 자동 재시도) */
async function requestVision(base64, { retries = 1 } = {}) {
    const body = JSON.stringify({
        max_tokens: 800,
        messages: [
            {
                role: "user",
                content: [
                    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
                    { type: "text", text: buildPrompt() },
                ],
            },
        ],
    });
    for (let attempt = 0;; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), VISION_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(VISION_API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctrl.signal });
        }
        catch (e) {
            if (e && e.name === "AbortError")
                throw new VisionError("TIMEOUT", "AI 응답이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.");
            const offline = typeof navigator !== "undefined" && navigator.onLine === false;
            throw new VisionError("NETWORK", offline ? "인터넷에 연결돼 있지 않아요." : "AI 서버에 연결하지 못했어요. 네트워크를 확인해 주세요.");
        }
        finally {
            clearTimeout(timer);
        }
        if (res.ok) {
            let json;
            try {
                json = await res.json();
            }
            catch (e) {
                throw new VisionError("BAD_RESPONSE", "서버 응답을 읽지 못했어요. 프록시 설정을 확인해 주세요.");
            }
            try {
                const text = (json.content || []).map((c) => (c.type === "text" ? c.text : "")).join("");
                return sanitize(extractJson(text));
            }
            catch (e) {
                throw new VisionError("BAD_RESPONSE", "AI 응답을 해석하지 못했어요. 다시 시도해 주세요.");
            }
        }
        if ([429, 502, 503, 504, 529].includes(res.status) && attempt < retries) {
            const ra = Number(res.headers && res.headers.get && res.headers.get("retry-after"));
            await sleep(Math.min(8000, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2500 * (attempt + 1)));
            continue;
        }
        throw httpError(res.status);
    }
}
const analyzePhoto = async (photo) => requestVision(await toJpegBase64(photo.url));
/* ---------------- 점수 계산 ---------------- */
/**
 * evidence: {그룹:{값:신뢰도}} — 최종 선택된 형질만 담김
 * 그룹별 신뢰도를 정규화해 수종 traits와 겹치는 비율(m)을 구하고,
 * 가중치 = 형질가중치 × 근거 강도 × (해당 부위 사진이 있으면 1.25)
 */
function scoreTree(tree, evidence, photoParts) {
    let got = 0, max = 0;
    const detail = {};
    TRAIT_GROUPS.forEach((g) => {
        const ev = evidence[g.id];
        if (!ev)
            return;
        const E = Object.values(ev).reduce((a, b) => a + b, 0);
        if (E <= 0)
            return;
        const m = tree.traits[g.id].reduce((a, v) => a + (ev[v] || 0) / E, 0);
        const w = g.w * Math.min(1, E) * (photoParts.has(g.part) ? 1.25 : 1);
        got += w * Math.min(1, m);
        max += w;
        detail[g.id] = m >= 0.5 ? "match" : "miss";
    });
    return { pct: max ? Math.round((got / max) * 100) : 0, detail };
}
const diffGroups = (a, b) => TRAIT_GROUPS.filter((g) => !a.traits[g.id].some((v) => b.traits[g.id].includes(v)));
/* ---------------- 이미지 · 공통 UI ---------------- */
const ART = {
    leaf: "<path d='M200 62C282 104 296 196 200 246C104 196 118 104 200 62Z' fill='#a9c2ac'/><path d='M200 76V262M200 130L160 106M200 130L240 106M200 172L152 148M200 172L248 148' stroke='#5f8068' stroke-width='3' fill='none' stroke-linecap='round'/>",
    bark: "<rect x='130' y='30' width='140' height='240' rx='14' fill='#b8a58f'/><path d='M158 40C150 110 170 180 156 262M192 36C186 104 206 190 190 266M228 40C222 120 240 190 226 262M256 44C252 100 262 180 254 258' stroke='#7d6b57' stroke-width='5' fill='none' stroke-linecap='round'/>",
    fruit: "<circle cx='200' cy='164' r='54' fill='#d2bb86'/><path d='M200 110C200 90 204 80 212 70' stroke='#6c7f5c' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M206 84C230 70 250 78 252 92C232 98 214 96 206 84Z' fill='#9db8a2'/>",
};
const PLACEHOLDER = (part, label) => "data:image/svg+xml;utf8," +
    encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='#e8ede6'/>${ART[part] || ART.leaf}<text x='200' y='288' text-anchor='middle' font-size='14' fill='#6d7d6a' font-family='sans-serif'>${String(label).replace(/[<>&']/g, "")}</text></svg>`);
function SafeImg({ src, alt, part = "leaf", className = "h-full w-full object-cover" }) {
    const [bad, setBad] = useState(false);
    useEffect(() => setBad(false), [src]);
    return React.createElement("img", { src: bad ? PLACEHOLDER(part, alt) : src, alt: alt, onError: () => setBad(true), className: className, loading: "lazy", draggable: false });
}
const Spinner = ({ className = "h-4 w-4" }) => (React.createElement("span", { className: `inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`, "aria-hidden": "true" }));
class ErrorBoundary extends React.Component {
    constructor(p) {
        super(p);
        this.state = { err: null };
    }
    static getDerivedStateFromError(err) {
        return { err };
    }
    render() {
        if (this.state.err)
            return (React.createElement("div", { className: "mx-auto mt-10 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900" },
                React.createElement("p", { className: "font-bold" }, "\uD654\uBA74\uC744 \uD45C\uC2DC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694."),
                React.createElement("button", { type: "button", onClick: () => this.setState({ err: null }), className: "mt-3 min-h-[44px] rounded-lg bg-rose-700 px-4 font-semibold text-white" }, "\uB2E4\uC2DC \uC2DC\uB3C4")));
        return this.props.children;
    }
}
function Lightbox({ item, onClose }) {
    useEffect(() => {
        if (!item)
            return;
        const h = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [item, onClose]);
    if (!item)
        return null;
    return (React.createElement("div", { role: "dialog", "aria-modal": "true", onClick: onClose, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" },
        React.createElement("div", { className: "max-h-full max-w-3xl overflow-hidden rounded-2xl" },
            React.createElement(SafeImg, { src: item.src, alt: item.alt, part: item.part, className: "max-h-[85vh] w-full object-contain" })),
        React.createElement("span", { className: "absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-stone-800" }, "\uB2EB\uAE30")));
}
/* ---------------- 1. 업로더 (사진만 올리면 끝) ---------------- */
function Uploader({ photos, onAdd, onRetry, onRemove, errors, clearErrors }) {
    const fileRef = useRef(null);
    const camRef = useRef(null);
    const pick = (e) => {
        onAdd(Array.from(e.target.files || []));
        e.target.value = "";
    };
    return (React.createElement("section", null,
        React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: pick }),
        React.createElement("input", { ref: camRef, type: "file", accept: "image/*", capture: "environment", className: "hidden", onChange: pick }),
        !photos.length ? (React.createElement("div", { className: "rounded-3xl bg-[#27463a] p-6 text-white sm:p-8" },
            React.createElement("h2", { className: "text-2xl font-bold leading-snug sm:text-3xl", style: { fontFamily: "'Noto Serif KR', serif" } },
                "\uC774 \uB098\uBB34, \uC774\uB984\uC774 \uBB58\uAE4C?",
                React.createElement("br", null),
                "\uC0AC\uC9C4\uB9CC \uC62C\uB824 \uBCF4\uC138\uC694"),
            React.createElement("p", { className: "mt-2 text-sm text-emerald-100/80" }, "\uC78E\u00B7\uC218\uD53C\u00B7\uC5F4\uB9E4 \uC0AC\uC9C4\uC744 \uC5EC\uB7EC \uC7A5 \uC62C\uB9AC\uBA74 AI\uAC00 \uD568\uAED8 \uC0B4\uD3B4\uBD10\uC694."),
            React.createElement("div", { className: "mt-5 flex flex-col gap-2 sm:flex-row" },
                React.createElement("button", { type: "button", onClick: () => { var _a; return (_a = camRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "min-h-[54px] flex-1 rounded-xl bg-white px-5 text-base font-bold text-[#27463a] active:bg-emerald-50" }, "\uCE74\uBA54\uB77C\uB85C \uCC0D\uAE30"),
                React.createElement("button", { type: "button", onClick: () => { var _a; return (_a = fileRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "min-h-[54px] flex-1 rounded-xl border border-white/40 px-5 text-base font-semibold text-white active:bg-white/10" }, "\uC568\uBC94\uC5D0\uC11C \uACE0\uB974\uAE30")))) : (React.createElement("div", { className: "flex gap-2 overflow-x-auto pb-1" },
            photos.map((p) => (React.createElement("div", { key: p.id, className: "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200" },
                React.createElement(SafeImg, { src: p.url, alt: p.name, part: p.part }),
                p.ai.status === "pending" && (React.createElement("div", { className: "absolute inset-0 flex items-center justify-center bg-[#27463a]/65 text-white" },
                    React.createElement(Spinner, { className: "h-5 w-5" }))),
                p.ai.status === "error" && (React.createElement("button", { type: "button", onClick: () => onRetry(p.id), className: "absolute inset-0 flex items-center justify-center bg-rose-700/85 px-1 text-center text-[11px] font-semibold text-white" }, "\uB2E4\uC2DC \uC2DC\uB3C4")),
                p.ai.status === "rejected" && (React.createElement("div", { className: "absolute inset-x-0 bottom-0 bg-amber-600/90 py-0.5 text-center text-[10px] font-semibold text-white" }, "\uC2DD\uBB3C \uC544\uB2D8")),
                React.createElement("button", { type: "button", onClick: () => onRemove(p.id), "aria-label": `${p.name} 삭제`, className: "absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[11px] text-white" }, "\u2715")))),
            photos.length < MAX_PHOTOS && (React.createElement(React.Fragment, null,
                React.createElement("button", { type: "button", onClick: () => { var _a; return (_a = fileRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#27463a]/40 text-xs font-semibold text-[#27463a]" },
                    React.createElement("span", { className: "text-xl leading-none" }, "\uFF0B"),
                    "\uCD94\uAC00"),
                React.createElement("button", { type: "button", onClick: () => { var _a; return (_a = camRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-[#27463a] text-xs font-semibold text-white" }, "\uCD2C\uC601"))))),
        errors.length > 0 && (React.createElement("div", { role: "alert", className: "mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" },
            errors.map((e, i) => (React.createElement("p", { key: i }, e))),
            React.createElement("button", { type: "button", onClick: clearErrors, className: "mt-1 text-xs underline" }, "\uD655\uC778")))));
}
/* ---------------- 2. 결과: 비교 · 경로 ---------------- */
const H3 = ({ children }) => (React.createElement("h3", { className: "mb-3 text-xl font-bold text-[#1c2b24]", style: { fontFamily: "'Noto Serif KR', serif" } }, children));
function TaxonomyLadder({ tree }) {
    const rows = RANK_ROWS(tree.id);
    if (!rows.length)
        return null;
    return (React.createElement("section", null,
        React.createElement(H3, null, "\uBD84\uB958 \uCCB4\uACC4"),
        React.createElement("ol", { className: "space-y-1.5" }, rows.map(([ko, en, [name, latin]], i) => {
            const last = i === rows.length - 1;
            return (React.createElement("li", { key: ko, style: { marginLeft: `${i * 10}px` }, className: `flex items-center gap-3 rounded-xl p-2.5 ring-1 ${last ? "bg-[#27463a] text-white ring-[#27463a]" : "bg-white ring-stone-200"}` },
                React.createElement("span", { className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-bold ${last ? "bg-amber-400 text-stone-900" : "bg-[#27463a]/10 text-[#27463a]"}` }, ko),
                React.createElement("span", { className: "min-w-0" },
                    React.createElement("span", { className: "block text-[11px] opacity-60" }, en),
                    React.createElement("span", { className: "block truncate font-semibold" }, name),
                    React.createElement("span", { className: `block truncate text-xs italic ${last ? "text-emerald-100" : "text-stone-500"}` }, latin))));
        })),
        React.createElement("p", { className: "mt-2 text-xs leading-relaxed text-stone-500" }, "\uC704 \uACC4\uAE09\uC740 \uD310\uBCC4\uB41C \uC885\uC774 \uC18D\uD55C \uBD84\uB958 \uC704\uCE58\uC785\uB2C8\uB2E4. \uC0AC\uC9C4\uC5D0\uC11C\uB294 \uC544\uB798 \uB3D9\uC815 \uACBD\uB85C\uC758 \uD615\uC9C8\uB85C \uC885\uC744 \uC881\uD788\uACE0, \uACC4\u00B7\uBB38\u00B7\uAC15\u00B7\uBAA9\uC740 \uB3C4\uAC10 \uAE30\uC900 \uBD84\uB958\uB97C \uBCF4\uC5EC\uC90D\uB2C8\uB2E4. \uBD84\uB958 \uD45C\uAE30\uB294 KPNI\uC640 \uB300\uC870\uD574 \uD655\uC778\uD558\uC138\uC694.")));
}
function Compare({ tree, photos, onZoom }) {
    const [idx, setIdx] = useState({});
    return (React.createElement("section", null,
        React.createElement(H3, null, "\uB0B4 \uC0AC\uC9C4 vs \uB3C4\uAC10"),
        React.createElement("div", { className: "space-y-6" }, Object.entries(PARTS).map(([part, meta]) => {
            const mine = photos.filter((p) => p.part === part);
            const cur = mine[Math.min(idx[part] || 0, Math.max(0, mine.length - 1))];
            const tiles = [
                cur ? { key: "me", src: cur.url, alt: `내 ${meta.label} 사진`, tag: "내 사진" } : null,
                { key: "ref", src: tree.images[part], alt: `${tree.name} ${meta.label}`, tag: `도감 · ${tree.name}` },
            ];
            return (React.createElement("div", { key: part },
                React.createElement("p", { className: "mb-2 text-sm font-semibold text-stone-600" }, meta.label),
                React.createElement("div", { className: "grid grid-cols-2 gap-2 sm:gap-4" }, tiles.map((c, i) => c ? (React.createElement("button", { key: c.key, type: "button", onClick: () => onZoom({ src: c.src, alt: c.alt, part }), "aria-label": `${c.alt} 크게 보기`, className: "relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200 sm:aspect-[4/3]" },
                    React.createElement(SafeImg, { src: c.src, alt: c.alt, part: part }),
                    React.createElement("span", { className: `absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${c.key === "me" ? "bg-teal-700" : "bg-[#27463a]"}` }, c.tag))) : (React.createElement("div", { key: i, className: "flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-stone-300 p-3 text-center text-xs text-stone-400 sm:aspect-[4/3]" },
                    meta.label,
                    " \uC0AC\uC9C4\uC744 \uC62C\uB9AC\uBA74",
                    React.createElement("br", null),
                    "\uB098\uB780\uD788 \uBE44\uAD50\uB3FC\uC694")))),
                (cur === null || cur === void 0 ? void 0 : cur.ai.note) && (React.createElement("p", { className: "mt-2 rounded-xl bg-teal-50 p-2.5 text-xs leading-relaxed text-teal-900" },
                    React.createElement("b", null, "AI \uD310\uB3C5 \uBA54\uBAA8"),
                    " \u00B7 ",
                    cur.ai.note)),
                mine.length > 1 && (React.createElement("div", { className: "mt-2 flex gap-2 overflow-x-auto" }, mine.map((p, i) => (React.createElement("button", { key: p.id, type: "button", onClick: () => setIdx((s) => ({ ...s, [part]: i })), "aria-label": `내 ${meta.label} 사진 ${i + 1}`, className: `h-12 w-12 shrink-0 overflow-hidden rounded-lg ${(cur === null || cur === void 0 ? void 0 : cur.id) === p.id ? "ring-2 ring-teal-600" : "opacity-60"}` },
                    React.createElement(SafeImg, { src: p.url, alt: "", part: part }))))))));
        }))));
}
function PathTimeline({ tree, sel, conf }) {
    return (React.createElement("section", null,
        React.createElement(H3, null, "\uB3D9\uC815 \uACBD\uB85C"),
        React.createElement("ol", { className: "relative ml-3 border-l-2 border-[#27463a]/25 pl-6" },
            tree.keyPath.map((s, i) => {
                var _a;
                const chosen = sel[s.g] || [];
                const state = !chosen.length ? "none" : chosen.includes(s.v) ? "ok" : "no";
                return (React.createElement("li", { key: i, className: "relative pb-4" },
                    React.createElement("span", { className: `absolute -left-[38px] flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${state === "ok" ? "bg-[#27463a]" : state === "no" ? "bg-rose-600" : "bg-stone-400"}` }, state === "ok" ? "✓" : state === "no" ? "!" : i + 1),
                    React.createElement("div", { className: `rounded-2xl p-3 ring-1 ${state === "no" ? "bg-rose-50 ring-rose-200" : "bg-white ring-stone-200"}` },
                        React.createElement("p", { className: "text-xs text-stone-500" }, s.q),
                        React.createElement("p", { className: "mt-0.5 font-semibold text-[#1c2b24]" }, s.a),
                        React.createElement("p", { className: "mt-1.5 text-xs" },
                            state === "ok" && React.createElement("span", { className: "rounded-full bg-teal-600 px-2 py-0.5 text-white" },
                                "AI \uD310\uB3C5\uACFC \uC77C\uCE58 ",
                                Math.round((((_a = conf[s.g]) === null || _a === void 0 ? void 0 : _a[s.v]) || 0) * 100),
                                "%"),
                            state === "no" && React.createElement("span", { className: "text-rose-700" },
                                "AI \uD310\uB3C5: ",
                                chosen.map((v) => LABEL(s.g, v)).join(", "),
                                " \u2014 \uB2E4\uB984"),
                            state === "none" && React.createElement("span", { className: "text-stone-400" }, "\uC0AC\uC9C4\uC5D0\uC11C \uD655\uC778\uB418\uC9C0 \uC54A\uC740 \uB2E8\uACC4")))));
            }),
            React.createElement("li", { className: "relative" },
                React.createElement("span", { className: "absolute -left-[38px] flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm" }, "\u2605"),
                React.createElement("div", { className: "rounded-2xl bg-[#27463a] p-3 text-white" },
                    React.createElement("p", { className: "text-lg font-bold", style: { fontFamily: "'Noto Serif KR', serif" } }, tree.name),
                    React.createElement("p", { className: "text-xs italic text-emerald-100" }, tree.sci))))));
}
function Advisory({ ranked, photos, onPick }) {
    const best = ranked[0];
    const second = ranked[1];
    const low = best.pct < LOW_MATCH_THRESHOLD;
    const close = !low && second && best.pct - second.pct <= CLOSE_GAP;
    if (!low && !close)
        return null;
    const noPhoto = Object.entries(PARTS).filter(([k]) => !photos.some((p) => p.part === k)).map(([, v]) => v.label);
    const diffs = close ? diffGroups(best.tree, second.tree).map((g) => g.label) : [];
    return (React.createElement("section", { role: "status", className: "rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-300" },
        React.createElement("p", { className: "font-bold" }, low ? "아직 확신하기 어려워요" : "비슷한 후보가 있어요"),
        React.createElement("ul", { className: "mt-1.5 list-disc space-y-1 pl-5" },
            close && diffs.length > 0 && React.createElement("li", null,
                best.tree.name,
                "\uACFC(\uC640) ",
                second.tree.name,
                "\uC740(\uB294) ",
                diffs.join(", "),
                "\uC5D0\uC11C \uB2EC\uB77C\uC694. \uADF8 \uBD80\uC704\uB97C \uAC00\uAE4C\uC774\uC11C \uCC0D\uC5B4 \uCD94\uAC00\uD574 \uBCF4\uC138\uC694."),
            noPhoto.length > 0 && React.createElement("li", null,
                noPhoto.join(", "),
                " \uC0AC\uC9C4\uC744 \uB354\uD558\uBA74 \uADFC\uAC70\uAC00 \uB298\uC5B4\uC694."),
            low && React.createElement("li", null, "\uB4F1\uB85D\uB41C 8\uC885 \uBC16\uC758 \uC2DD\uBB3C\uC77C \uC218\uB3C4 \uC788\uC5B4\uC694. \uB2E4\uB978 \uD6C4\uBCF4\uB3C4 \uC0B4\uD3B4\uBCF4\uC138\uC694.")),
        React.createElement("div", { className: "mt-3 flex flex-wrap gap-2" }, ranked.slice(1, 3).map((r) => (React.createElement("button", { key: r.tree.id, type: "button", onClick: () => onPick(r.tree.id), className: "min-h-[40px] rounded-lg bg-white px-3 font-semibold ring-1 ring-amber-400" },
            r.tree.name,
            " ",
            r.pct,
            "%"))))));
}
function Results({ ranked, sel, conf, photos }) {
    const topId = ranked[0].tree.id;
    const [activeId, setActiveId] = useState(topId);
    const [zoom, setZoom] = useState(null);
    useEffect(() => setActiveId(topId), [topId]);
    const cur = ranked.find((r) => r.tree.id === activeId) || ranked[0];
    const t = cur.tree;
    const closeZoom = useCallback(() => setZoom(null), []);
    const matched = Object.entries(cur.detail).filter(([, r]) => r === "match").map(([g]) => groupOf(g).label);
    return (React.createElement("div", { className: "space-y-6" },
        React.createElement("section", { className: "rounded-3xl bg-[#27463a] p-5 text-white sm:p-6" },
            React.createElement("p", { className: "text-xs text-emerald-200" },
                t.family,
                t.id === topId ? " · 가장 가까운 후보" : ""),
            React.createElement("div", { className: "mt-1 flex items-end justify-between gap-3" },
                React.createElement("div", null,
                    React.createElement("h2", { className: "text-3xl font-bold", style: { fontFamily: "'Noto Serif KR', serif" } }, t.name),
                    React.createElement("p", { className: "text-sm italic text-emerald-100" }, t.sci)),
                React.createElement("p", { className: "text-4xl font-bold tabular-nums" },
                    cur.pct,
                    React.createElement("span", { className: "text-lg" }, "%"))),
            React.createElement("div", { className: "mt-3 h-1.5 overflow-hidden rounded-full bg-white/20" },
                React.createElement("div", { className: "h-full rounded-full bg-amber-400", style: { width: `${cur.pct}%` } })),
            matched.length > 0 && (React.createElement("div", { className: "mt-3 flex flex-wrap gap-1.5" }, matched.map((m) => (React.createElement("span", { key: m, className: "rounded-full bg-white/15 px-2.5 py-0.5 text-xs" },
                "\u2713 ",
                m,
                " \uC77C\uCE58"))))),
            React.createElement("ul", { className: "mt-4 list-disc space-y-1 pl-5 text-sm text-emerald-50" }, t.features.slice(0, 3).map((f) => React.createElement("li", { key: f }, f)))),
        React.createElement(Advisory, { ranked: ranked, photos: photos, onPick: setActiveId }),
        React.createElement("div", { className: "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1", role: "tablist", "aria-label": "\uD6C4\uBCF4 \uC218\uC885" }, ranked.slice(0, 5).map(({ tree, pct }) => (React.createElement("button", { key: tree.id, type: "button", role: "tab", "aria-selected": tree.id === t.id, onClick: () => setActiveId(tree.id), className: `shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tree.id === t.id ? "bg-[#1c2b24] text-white" : "bg-white text-stone-700 ring-1 ring-stone-300"}` },
            tree.name,
            " ",
            React.createElement("span", { className: "opacity-70" },
                pct,
                "%"))))),
        React.createElement(TaxonomyLadder, { tree: t }),
        React.createElement(Compare, { tree: t, photos: photos, onZoom: setZoom }),
        React.createElement(PathTimeline, { tree: t, sel: sel, conf: conf }),
        React.createElement(Lightbox, { item: zoom, onClose: closeZoom })));
}
/* ---------------- App ---------------- */
function KeyTreeApp() {
    const [photos, setPhotos] = useState([]);
    const [errors, setErrors] = useState([]);
    const photosRef = useRef([]);
    const queue = useRef([]);
    const active = useRef(0);
    const resultRef = useRef(null);
    const hadResult = useRef(false);
    const addInputRef = useRef(null);
    // ref와 state를 항상 함께 갱신 (큐 처리에서 최신 목록을 읽기 위함)
    const commit = useCallback((fn) => {
        photosRef.current = fn(photosRef.current);
        setPhotos(photosRef.current);
    }, []);
    useEffect(() => {
        if ("serviceWorker" in navigator)
            navigator.serviceWorker.register("/sw.js").catch(() => { });
        return () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    }, []);
    // 동시 요청 수를 제한해 API 호출 한도를 보호
    const pump = useCallback(function run() {
        while (active.current < MAX_CONCURRENT && queue.current.length) {
            const photo = queue.current.shift();
            const live = photosRef.current.find((p) => p.id === photo.id);
            if (!live || live.rev !== photo.rev)
                continue; // 삭제됐거나 낡은 요청
            active.current++;
            analyzePhoto(photo)
                .then((r) => (r.isPlant ? { status: "done", ...r } : { status: "rejected" }))
                .catch((e) => ({ status: "error", code: (e === null || e === void 0 ? void 0 : e.code) || "UNKNOWN", error: (e === null || e === void 0 ? void 0 : e.message) || "분석하지 못했어요. 다시 시도해 주세요." }))
                .then((ai) => {
                commit((ps) => ps.map((x) => (x.id === photo.id && x.rev === photo.rev ? { ...x, ai, part: ai.part || x.part } : x)));
                active.current--;
                run();
            });
        }
    }, [commit]);
    const enqueue = useCallback((photo) => {
        queue.current.push(photo);
        pump();
    }, [pump]);
    // 사진이 올라오면 즉시 AI 분석 시작
    const addFiles = (files) => {
        const errs = [];
        let room = MAX_PHOTOS - photosRef.current.length;
        const added = [];
        files.forEach((f, i) => {
            if (!f.type.startsWith("image/"))
                return errs.push(`'${f.name}'은(는) 사진 파일이 아니에요.`);
            if (f.size > MAX_FILE_MB * 1024 * 1024)
                return errs.push(`'${f.name}'은(는) ${MAX_FILE_MB}MB를 넘어요.`);
            if (room <= 0)
                return errs.push(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
            room--;
            added.push({ id: `${Date.now()}-${i}-${f.name}`, url: URL.createObjectURL(f), name: f.name, part: "leaf", rev: 0, ai: { status: "pending" } });
        });
        setErrors(errs);
        if (added.length) {
            commit((ps) => [...ps, ...added]);
            added.forEach(enqueue);
        }
    };
    const retry = (ids) => {
        const targets = photosRef.current.filter((p) => ids.includes(p.id));
        if (!targets.length)
            return;
        const nexts = targets.map((p) => ({ ...p, rev: p.rev + 1, ai: { status: "pending" } }));
        commit((ps) => ps.map((p) => nexts.find((n) => n.id === p.id) || p));
        nexts.forEach(enqueue);
    };
    const remove = (id) => {
        const t = photosRef.current.find((p) => p.id === id);
        if (t)
            URL.revokeObjectURL(t.url);
        commit((ps) => ps.filter((p) => p.id !== id));
    };
    const reset = () => {
        photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
        queue.current = [];
        commit(() => []);
        setErrors([]);
    };
    const pending = photos.some((p) => p.ai.status === "pending");
    const done = useMemo(() => photos.filter((p) => p.ai.status === "done"), [photos]);
    const failed = photos.filter((p) => p.ai.status === "error");
    const settled = photos.length - photos.filter((p) => p.ai.status === "pending").length;
    // 사진별 판독 확률 → 그룹/값별 최대 확률(품질 낮으면 0.7배) → 임계값 이상만 확정
    const { sel, conf, candP } = useMemo(() => {
        const prob = {}, cand = {};
        done.forEach((p) => {
            const k = p.ai.quality === "poor" ? 0.7 : 1;
            Object.entries(p.ai.traits).forEach(([g, vs]) => Object.entries(vs).forEach(([v, pr]) => {
                prob[g] = prob[g] || {};
                prob[g][v] = Math.max(prob[g][v] || 0, pr * k);
            }));
            p.ai.candidates.forEach((c) => (cand[c.id] = Math.max(cand[c.id] || 0, c.p * k)));
        });
        const s = {}, c = {};
        TRAIT_GROUPS.forEach((g) => {
            const picked = Object.entries(prob[g.id] || {}).filter(([, p]) => p >= AI_SELECT_THRESHOLD);
            s[g.id] = picked.map(([v]) => v);
            c[g.id] = Object.fromEntries(picked);
        });
        return { sel: s, conf: c, candP: cand };
    }, [done]);
    // 판독이 끝나면 자동으로 동정: 형질 점수(75%) + AI 후보 확률(25%)
    const ranked = useMemo(() => {
        if (pending || !done.length)
            return null;
        const evidence = {};
        TRAIT_GROUPS.forEach((g) => {
            if (Object.keys(conf[g.id]).length)
                evidence[g.id] = conf[g.id];
        });
        const hasTraits = Object.keys(evidence).length > 0;
        const hasCand = Object.keys(candP).length > 0;
        if (!hasTraits && !hasCand)
            return null;
        const parts = new Set(done.map((p) => p.part));
        return TREE_DATABASE.map((tree) => {
            const s = hasTraits ? scoreTree(tree, evidence, parts) : { pct: 0, detail: {} };
            const c = (candP[tree.id] || 0) * 100;
            const pct = hasTraits ? (hasCand ? Math.round(0.75 * s.pct + 0.25 * c) : s.pct) : Math.round(c);
            return { tree, pct, detail: s.detail };
        }).sort((a, b) => b.pct - a.pct);
    }, [pending, done, conf, candP]);
    // 결과가 처음 나타날 때 부드럽게 스크롤
    useEffect(() => {
        var _a;
        if (ranked && !hadResult.current)
            (_a = resultRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "start" });
        hadResult.current = !!ranked;
    }, [ranked]);
    const settledNoResult = photos.length > 0 && !pending && !ranked;
    const onlyNonPlant = settledNoResult && !done.length && !failed.length;
    const noTraits = settledNoResult && done.length > 0;
    return (React.createElement("div", { className: "min-h-screen bg-[#f2f5f1] pb-16 text-[#1c2b24]", style: { fontFamily: "'Noto Sans KR', system-ui, sans-serif" } },
        React.createElement("header", { className: "sticky top-0 z-20 border-b border-stone-200 bg-[#f2f5f1]/90 backdrop-blur" },
            React.createElement("div", { className: "mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5" },
                React.createElement("div", { className: "flex items-center gap-2" },
                    React.createElement("svg", { viewBox: "0 0 24 24", className: "h-7 w-7 text-[#27463a]", fill: "currentColor", "aria-hidden": "true" },
                        React.createElement("path", { d: "M12 2C18 5 20 11 12 22C4 11 6 5 12 2Z" })),
                    React.createElement("div", null,
                        React.createElement("h1", { className: "text-xl font-black leading-none", style: { fontFamily: "'Noto Serif KR', serif" } }, "KeyTree"),
                        React.createElement("p", { className: "mt-0.5 text-[11px] text-stone-500" }, "AI \uC0AC\uC9C4 \uD310\uB3C5 \uC218\uBAA9 \uB3D9\uC815"))),
                photos.length > 0 && (React.createElement("button", { type: "button", onClick: reset, className: "min-h-[44px] px-2 text-sm text-stone-600 underline" }, "\uCC98\uC74C\uBD80\uD130")))),
        React.createElement("main", { className: "mx-auto max-w-3xl space-y-6 px-4 pt-5" },
            React.createElement(Uploader, { photos: photos, onAdd: addFiles, onRetry: (id) => retry([id]), onRemove: remove, errors: errors, clearErrors: () => setErrors([]) }),
            pending && (React.createElement("div", { role: "status", className: "space-y-3" },
                React.createElement("div", { className: "flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200" },
                    React.createElement(Spinner, { className: "h-6 w-6 text-[#27463a]" }),
                    React.createElement("div", { className: "flex-1" },
                        React.createElement("p", { className: "font-semibold" }, "AI\uAC00 \uC0AC\uC9C4\uC744 \uBD84\uC11D\uD558\uACE0 \uC788\uC5B4\uC694"),
                        React.createElement("p", { className: "text-xs text-stone-500" },
                            "\uC78E\u00B7\uC218\uD53C\u00B7\uC5F4\uB9E4\uC758 \uD615\uD0DC\uB97C \uC77D\uB294 \uC911 (",
                            settled,
                            "/",
                            photos.length,
                            ")"),
                        React.createElement("div", { className: "mt-2 h-1 overflow-hidden rounded-full bg-stone-200" },
                            React.createElement("div", { className: "h-full bg-[#27463a] transition-all", style: { width: `${(settled / photos.length) * 100}%` } })))),
                React.createElement("div", { className: "h-40 animate-pulse rounded-3xl bg-stone-200/70" }))),
            !pending && failed.length > 0 && (React.createElement("section", { role: "alert", className: "rounded-2xl bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-rose-200" },
                React.createElement("p", { className: "font-bold" },
                    "\uBD84\uC11D\uD558\uC9C0 \uBABB\uD55C \uC0AC\uC9C4\uC774 ",
                    failed.length,
                    "\uC7A5 \uC788\uC5B4\uC694"),
                React.createElement("p", { className: "mt-1" }, failed[0].ai.error),
                React.createElement("button", { type: "button", onClick: () => retry(failed.map((p) => p.id)), className: "mt-3 min-h-[44px] rounded-lg bg-rose-700 px-4 font-semibold text-white" }, "\uB2E4\uC2DC \uC2DC\uB3C4"))),
            onlyNonPlant && (React.createElement("section", { role: "status", className: "rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200" },
                React.createElement("p", { className: "font-bold" }, "\uC2DD\uBB3C \uC0AC\uC9C4\uC774 \uC544\uB2CC \uAC83 \uAC19\uC544\uC694"),
                React.createElement("p", { className: "mt-2 text-sm text-stone-600" }, "\uC78E, \uC218\uD53C, \uC5F4\uB9E4\uAC00 \uC798 \uBCF4\uC774\uB294 \uC0AC\uC9C4\uC73C\uB85C \uB2E4\uC2DC \uC62C\uB824 \uC8FC\uC138\uC694."))),
            noTraits && (React.createElement("section", { role: "status", className: "rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200" },
                React.createElement("p", { className: "font-bold" }, "\uC0AC\uC9C4\uC5D0\uC11C \uB69C\uB837\uD55C \uD2B9\uC9D5\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694"),
                React.createElement("p", { className: "mt-2 text-sm leading-relaxed text-stone-600" }, "\uC78E \uC55E\uB4A4, \uC218\uD53C, \uC5F4\uB9E4\uB97C \uAC00\uAE4C\uC774\uC11C \uBC1D\uAC8C \uCC0D\uC5B4 \uCD94\uAC00\uD558\uBA74 AI\uAC00 \uB2E4\uC2DC \uD310\uB2E8\uD574\uC694."),
                React.createElement("button", { type: "button", onClick: () => { var _a; return (_a = addInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }, className: "mt-4 min-h-[48px] rounded-xl bg-[#27463a] px-5 font-semibold text-white" }, "\uC0AC\uC9C4 \uB354 \uC62C\uB9AC\uAE30"))),
            React.createElement("input", { ref: addInputRef, type: "file", accept: "image/*", multiple: true, className: "hidden", onChange: (e) => {
                    addFiles(Array.from(e.target.files || []));
                    e.target.value = "";
                } }),
            ranked && (React.createElement("div", { ref: resultRef, className: "scroll-mt-20" },
                React.createElement(Results, { ranked: ranked, sel: sel, conf: conf, photos: done }),
                React.createElement("p", { className: "mt-6 pb-4 text-center text-xs text-stone-400" }, "AI \uD310\uB3C5\uC740 \uD2C0\uB9B4 \uC218 \uC788\uC5B4\uC694. \uB3C4\uAC10 \uC0AC\uC9C4\uACFC \uC9C1\uC811 \uB300\uC870\uD574 \uCD5C\uC885 \uD655\uC778\uD558\uC138\uC694."))))));
}
function App() {
    return (React.createElement(ErrorBoundary, null,
        React.createElement(KeyTreeApp, null)));
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
})();
