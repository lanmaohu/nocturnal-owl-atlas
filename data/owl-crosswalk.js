export const crosswalkUrl = 'https://github.com/alchaincyf/huashu-bird-sticker/blob/01264126448bd3d5d3bf69102abbfe98d9e3b489/data/crosswalk-ioc15.2-avilist2026.csv'

// Original IOC 15.2 IDs whose taxon concepts changed in AviList v2026.
const changes = new Map([
  ["Tyto_tenebricosa", "AviList v2026 扩大了本种的范围，将首版的小乌草鸮并入本种。"],
  ["Tyto_multipunctata", "AviList v2026 将本种并入 Tyto tenebricosa，列为亚种 Tyto tenebricosa multipunctata。"],
  ["Tyto_nigrobrunnea", "AviList v2026 将本种并入 Tyto javanica，列为亚种 Tyto javanica nigrobrunnea。"],
  ["Tyto_sororcula", "AviList v2026 将本种并入 Tyto novaehollandiae，列为亚种 Tyto novaehollandiae sororcula。"],
  ["Tyto_manusi", "AviList v2026 将本种并入 Tyto novaehollandiae，列为亚种 Tyto novaehollandiae manusi。"],
  ["Tyto_novaehollandiae", "AviList v2026 扩大了本种的范围，将首版的小草鸮、马努斯草鸮并入本种。"],
  ["Tyto_rosenbergii", "AviList v2026 将本种并入 Tyto javanica，列为亚种 Tyto javanica rosenbergii。"],
  ["Tyto_javanica", "AviList v2026 扩大了本种的范围，将首版的塔里仓鸮、苏拉威西苍鸮并入本种。"],
  ["Glaucidium_californicum", "AviList v2026 将本种并入 Glaucidium gnoma，列为亚种 Glaucidium gnoma californicum。"],
  ["Glaucidium_gnoma", "AviList v2026 扩大了本种的范围，将首版的北美鸺鹠、海角鸺鹠、危地马拉鸺鹠并入本种。"],
  ["Glaucidium_hoskinsii", "AviList v2026 将本种并入 Glaucidium gnoma，列为亚种 Glaucidium gnoma hoskinsii。"],
  ["Glaucidium_cobanense", "AviList v2026 将本种并入 Glaucidium gnoma，列为亚种 Glaucidium gnoma cobanense。"],
  ["Otus_madagascariensis", "AviList v2026 将本种并入 Otus rutilus，列为亚种 Otus rutilus madagascariensis。"],
  ["Otus_rutilus", "AviList v2026 扩大了本种的范围，将首版的托罗卡角鸮并入本种。"],
  ["Otus_senegalensis", "AviList v2026 扩大了本种的范围，将首版的安诺本角鸮并入本种。"],
  ["Otus_feae", "AviList v2026 将本种并入 Otus senegalensis，列为亚种 Otus senegalensis feae。"],
  ["Ketupa_blakistoni", "AviList v2026 将 Ketupa doerriesi 从本种拆出，列为独立物种。本页资料沿用拆分前的范围。"],
  ["Strix_aluco", "AviList v2026 扩大了本种的范围，将首版的马格里布林鸮并入本种。"],
  ["Strix_mauritanica", "AviList v2026 将本种并入 Strix aluco，列为亚种 Strix aluco mauritanica。"],
])

export function taxonomyChange(id) {
  return changes.get(id) || ''
}
