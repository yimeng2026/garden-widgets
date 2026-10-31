"""Verify quoted claims against locally retrieved primary sources; never promote abstracts to full texts."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import unicodedata

from bs4 import BeautifulSoup
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".tmp" / "fulltext"


def compact(value):
    normalized = unicodedata.normalize("NFKC", value or "")
    return re.sub(r"[\s\-‐‑‒–—_]+", "", normalized).lower()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def html_text(name):
    raw = SOURCE / name
    soup = BeautifulSoup(raw.read_text(encoding="utf-8"), "html.parser")
    for element in soup(["script", "style", "nav", "header", "footer"]):
        element.decompose()
    return soup.get_text(" ", strip=True)


def pdf_pages(name):
    raw = SOURCE / name
    extracted = json.loads((SOURCE / name.replace(".pdf", "-extract.json")).read_text(encoding="utf-8"))
    assert extracted["status"] == "success"
    pages = extracted["data"]["pages"]
    assert len(PdfReader(str(raw)).pages) == len(pages), f"Page coverage mismatch: {name}"
    return pages


def verify(source, text_or_pages):
    claims = []
    for claim in source["claims"]:
        if isinstance(text_or_pages, str):
            assert compact(claim["quote"]) in compact(text_or_pages), (source["key"], claim["quote"])
            locator = claim["locator"]
        else:
            matching = [page["page"] for page in text_or_pages if compact(claim["quote"]) in compact(page["text"])]
            assert matching, (source["key"], claim["quote"])
            locator = f"PDF 第 {matching[0]} 页"
        claims.append({**claim, "locator": locator, "verification": "quote_present"})
    return {
        "key": source["key"],
        "status": source["status"],
        "title": source["title"],
        "sourceUrl": source["url"],
        "license": source["license"],
        "coverage": source["coverage"],
        "sourceSha256": sha256(SOURCE / source["raw"]),
        "scope": source["scope"],
        "claims": claims,
    }


SOURCES = [
    {
        "key": "paper1-07", "status": "full_text_checked", "raw": "3hs4-pmc.html",
        "title": "High-resolution structure of human carbonic anhydrase II complexed with acetazolamide reveals insights into inhibitor drug design",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC2765883/",
        "license": "PMC 免费全文可读；未据此声明开放再分发许可。",
        "coverage": "PMC 正文全部主要章节，含实验方法与结果讨论。",
        "scope": "支持 3HS4 的野生型 CA II–AZM、1.1 Å 和直接结合；不支持统一 Ki、独立活性重复或本项目三类序列差异。",
        "claims": [
            {"quote": "The crystal structure of human carbonic anhydrase II (CA II) complexed with acetazolamide (AZM) has been determined at 1.1 Å resolution.", "locator": "摘要", "supports": "3HS4 为 1.1 Å 的 CA II–AZM 实验结构。"},
            {"quote": "Presented here is the refined crystal structure of wt CA II complexed with AZM at 1.1 Å resolution.", "locator": "§1 引言", "supports": "原文明确为野生型 CA II–AZM。"},
            {"quote": "the sulfonamide amine N atom of AZM 701 binds directly to the active-site Zn atom", "locator": "§3.1 AZM interactions with CA II", "supports": "AZM 在活性位点直接配位锌离子。"},
        ],
    },
    {
        "key": "paper1-11", "status": "abstract_checked", "raw": "2h4n-pubmed.html",
        "title": "Histidine --> carboxamide ligand substitutions in the zinc binding site of carbonic anhydrase II alter metal coordination geometry but retain catalytic activity",
        "url": "https://pubmed.ncbi.nlm.nih.gov/9398308/",
        "license": "PubMed／ACS 摘要可读；本次未取得全文。",
        "coverage": "仅摘要；出版社页面本次同样只返回摘要。",
        "scope": "摘要支持 H94N 构建及高分辨率 X 射线研究；起始 M 缺失、P 插入、260／259 长度不一致及全局比对只能由 PDB 和本地分析支持。",
        "claims": [
            {"quote": "High-resolution X-ray crystal structure determinations of H94N, H119N, and H119Q CAIIs reveal that the engineered carboxamide side chains coordinate to zinc with optimal stereochemistry.", "locator": "PubMed 摘要", "supports": "H94N 等构建的高分辨率 X 射线结构研究。"},
            {"quote": "This is demonstrated by catalytic activity measurements for ester hydrolysis and CO2 hydration, as well as sulfonamide inhibitor affinity assays.", "locator": "PubMed 摘要", "supports": "摘要报告了催化与抑制剂亲和力测量；不能替代具体实验数据核对。"},
        ],
    },
    {
        "key": "paper3-01", "status": "full_text_checked", "raw": "pysindy-2020.pdf",
        "title": "PySINDy: A Python package for the sparse identification of nonlinear dynamical systems from data",
        "url": "https://joss.theoj.org/papers/10.21105/joss.02104",
        "license": "CC BY 4.0。",
        "coverage": "PDF 全部 4 页。",
        "scope": "支持 SINDy 的方法组成、数值微分和 STLSQ 等选项；本地 2.1.0 版本与误差值由本机快照而非该论文证明。",
        "claims": [
            {"quote": "Applying SINDy involves making several modeling decisions, namely: which numerical differentiation method is used, which functions make up the feature library, and which sparse regression algorithm is applied to learn the model.", "supports": "规律辨识必须分别记录微分、候选库和稀疏回归口径。"},
            {"quote": "The package provides a few standard options for numerical differentiation (finite difference and smoothed finite difference), feature libraries (polynomial and Fourier libraries, as well as a class for creating custom libraries), and sparse regression techniques (sequentially thresholded least squares", "supports": "原文列明有限差分、候选库与 STLSQ 方法。"},
        ],
    },
    {
        "key": "paper3-02", "status": "full_text_checked", "raw": "pysindy-2022.pdf",
        "title": "PySINDy: A comprehensive Python package for robust sparse system identification",
        "url": "https://joss.theoj.org/papers/10.21105/joss.03994",
        "license": "CC BY 4.0。",
        "coverage": "PDF 全部 7 页。",
        "scope": "支持鲁棒 SINDy 扩展及微分方法差异；不把 2022 年论文的默认设置直接冒充本机 2.1.0 的行为。",
        "claims": [
            {"quote": "Robust formulations, including the integral form of SINDy and ensembling", "supports": "原文支持积分形式与集成方法等鲁棒扩展。"},
            {"quote": "PySINDy defaults to second order finite differences for computing derivatives, although a host of more sophisticated methods are now available", "supports": "该版本论文明确说明默认微分与其他可选方法；本机版本需另行固定。"},
        ],
    },
    {
        "key": "context-wilkinson-2016", "status": "full_text_checked", "raw": "fair-2016.pdf",
        "title": "The FAIR Guiding Principles for scientific data management and stewardship",
        "url": "https://www.nature.com/articles/sdata201618",
        "license": "CC BY 4.0；第三方内容按原署名条款。",
        "coverage": "PDF 全部 9 页，含 FAIR 原则、工作流讨论与许可。",
        "scope": "支持 FAIR 四项原则、详细来源信息和工作流资产；r-bundle 是本项目的轻量接口方法，不冒充 FAIR 原文术语或认证。",
        "claims": [
            {"quote": "R1.2. (meta)data are associated with detailed provenance", "supports": "可复用性要求详细的来源信息。"},
            {"quote": "The FAIR principles can equally be applied to these non-data assets, which need to be identified, described, discovered, and reused in much the same manner as data.", "supports": "FAIR 也适用于工作流等非数据研究资产。"},
        ],
    },
    {
        "key": "paper2-01", "status": "partial_text_checked", "raw": "ca13-snippets.txt",
        "title": "Carbonic anhydrase inhibitors. Inhibition of cytosolic isozyme XIII with aromatic and heterocyclic sulfonamides: a novel target for the drug design",
        "url": "https://www.sciencedirect.com/science/article/pii/S0960894X0400647X",
        "license": "出版社页面公开可读片段；未声明开放再分发许可。",
        "coverage": "摘要、引言与 CA inhibition data 片段；不是完整全文、Table 1 或完整协议。",
        "scope": "证明 CA I／II／IX 数据此前已发表；esterase 描述仍属于数据库策划记录，不能冒充完整方法。",
        "claims": [
            {"quote": "inhibition data against isozymes I, II, and IX have been published earlier, and will be not discussed in detail here", "locator": "CA inhibition data 片段", "supports": "CA I／II／IX 为此前发表数据。"},
        ],
    },
    {
        "key": "paper2-02", "status": "abstract_checked", "raw": "thiourea-abstract.txt",
        "title": "Carbonic Anhydrase Inhibitors: Water-Soluble 4-Sulfamoylphenylthioureas as Topical Intraocular Pressure-Lowering Agents with Long-Lasting Effects",
        "url": "https://pubmed.ncbi.nlm.nih.gov/11123998/",
        "license": "PubMed 摘要可读；本次未取得全文。",
        "coverage": "仅摘要。",
        "scope": "支持 CA I／II／IV 研究对象，不支持乙酰唑胺 Ki 的具体实验方法。",
        "claims": [
            {"quote": "The new thiourea derivatives showed strong affinities toward isozymes I, II, and IV of carbonic anhydrase (CA, EC 4.2.1.1).", "locator": "PubMed 摘要", "supports": "研究对象覆盖 CA I／II／IV。"},
        ],
    },
    {
        "key": "paper2-03", "status": "partial_text_checked", "raw": "emate-snippets.txt",
        "title": "Carbonic anhydrase inhibitors: X-ray crystallographic structure of the adduct of human isozyme II with EMATE, a dual inhibitor of carbonic anhydrases and steroid sulfatase",
        "url": "https://www.sciencedirect.com/science/article/pii/S0960894X03010448",
        "license": "出版社页面公开可读片段；未声明开放再分发许可。",
        "coverage": "摘要、引言、Chemistry 与 Crystallography 片段；不是完整全文或乙酰唑胺 Ki 协议。",
        "scope": "可读方法针对 EMATE—CA II 共结晶，不能据此补全乙酰唑胺活性测定方法。",
        "claims": [
            {"quote": "The hCA II–1 adduct obtained by co-crystallization, was subjected to detailed X-ray crystallography.", "locator": "Crystallography 片段", "supports": "实验片段针对 EMATE 复合物的 X 射线晶体学。"},
        ],
    },
    {
        "key": "paper2-04", "status": "abstract_checked", "raw": "carboxybenzolamide-abstract.txt",
        "title": "Carbonic anhydrase inhibitors: Topically acting antiglaucoma sulfonamides incorporating esters and amides of 3- and 4-carboxybenzolamide",
        "url": "https://pubmed.ncbi.nlm.nih.gov/14611846/",
        "license": "PubMed 摘要可读；本次未取得全文。",
        "coverage": "仅摘要。",
        "scope": "支持 CA I／II／IV 研究对象，不支持乙酰唑胺 Ki 的具体实验方法。",
        "claims": [
            {"quote": "The new derivatives showed low nanomolar affinity for three carbonic anhydrase (CA) isozymes, CA I, II and IV, and were effective as topical antiglaucoma agents in normotensive rabbits.", "locator": "PubMed 摘要", "supports": "研究对象覆盖 CA I／II／IV。"},
        ],
    },
    {
        "key": "paper2-05", "status": "partial_text_checked", "raw": "e7070-snippets.txt",
        "title": "Carbonic anhydrase inhibitors: E7070, a sulfonamide anticancer agent, potently inhibits cytosolic isozymes I and II, and transmembrane, tumor-associated isozyme IX",
        "url": "https://www.sciencedirect.com/science/article/pii/S0960894X03010424",
        "license": "出版社页面公开可读片段；未声明开放再分发许可。",
        "coverage": "引言与 Chemistry and CA inhibition 片段；不是完整全文、Table 1 或完整协议。",
        "scope": "确认六种化合物的四同工酶抑制表存在，但片段本身不给出乙酰唑胺 Ki 的完整测定条件。",
        "claims": [
            {"quote": "Inhibition data against four CA isozymes with the six compounds 1–6 are shown in Table 1.", "locator": "Chemistry and CA inhibition 片段", "supports": "原文有六种化合物、四个同工酶的抑制表。"},
        ],
    },
    {
        "key": "paper2-06", "status": "abstract_checked", "raw": "dtpa-abstract.txt",
        "title": "Carbonic anhydrase inhibitors: synthesis of sulfonamides incorporating dtpa tails and of their zinc complexes with powerful topical antiglaucoma properties",
        "url": "https://pubmed.ncbi.nlm.nih.gov/11229775/",
        "license": "PubMed 摘要可读；本次未取得全文。",
        "coverage": "仅摘要。",
        "scope": "支持 DTPA 论文的 CA I／II／IV 研究对象，不支持乙酰唑胺 Ki 的具体实验方法。",
        "claims": [
            {"quote": "Many of these derivatives showed nanomolar affinity towards isozymes I, II and IV of carbonic anhydrase (CA).", "locator": "PubMed 摘要", "supports": "研究对象覆盖 CA I／II／IV。"},
        ],
    },
]


def main():
    records = []
    for source in SOURCES:
        content = html_text(source["raw"]) if source["raw"].endswith((".html", ".txt")) else pdf_pages(source["raw"])
        records.append(verify(source, content))
    output = {
        "schemaVersion": 1,
        "snapshotType": "fulltext_evidence",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "scope": "全文核验指读取当前可获得的完整正文并核对指定论断，不等于独立实验复现或认可原文全部结论；摘要与全文严格分开。",
        "records": records,
    }
    target = ROOT / "snapshots" / "fulltext-evidence.json"
    target.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({record["key"]: {"status": record["status"], "claims": len(record["claims"])} for record in records}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
