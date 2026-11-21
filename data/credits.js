const release = 'https://github.com/alchaincyf/huashu-bird-sticker/blob/1ad86ebed0e3bc6f9d1a9ba993136b979e6aaae5/'

export const sourceLinks = {
  species: release + 'data/species.json',
  guide: release + 'data/field-guide.zh-Hans.json',
  dictionary: release + 'data/README.md',
  notice: release + 'NOTICE.md',
}

export const credits = [
  {
    label: '物种数据汇编',
    source: '花叔（alchaincyf）· huashu-bird-sticker 0.1.0。按首版物种 ID 节选鸮形目 251 种。',
    url: sourceLinks.species,
    license: 'MIT',
    licenseUrl: release + 'LICENSES/MIT.txt',
  },
  {
    label: '分类、鸟名、亚种与分布',
    source: 'IOC World Bird List v15.2 · Frank Gill、David Donsker、Pamela Rasmussen 编',
    url: 'https://worldbirdnames.org/',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  {
    label: '形态与生态',
    source: 'AVONET · Tobias 等，2022，Ecology Letters',
    url: 'https://doi.org/10.1111/ele.13898',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
  {
    label: '中文辨识笔记',
    source: '花叔依据中文维基百科等资料改写；每篇附原始依据页面。',
    url: sourceLinks.guide,
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    label: '外部编号、保护等级与别名',
    source: 'Wikidata；iNaturalist 编号来自 iNaturalist 分类。',
    url: 'https://www.wikidata.org/',
    license: 'Wikidata · CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    label: '中国国家保护级别',
    source: '国家林业和草原局、农业农村部《国家重点保护野生动物名录》（2021），按原库收录。',
    url: sourceLinks.dictionary,
  },
]

export const dataLicense = "MIT License\n\nCopyright (c) 2026 Huashu (alchaincyf)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE."
