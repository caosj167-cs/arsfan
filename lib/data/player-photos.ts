// ---------------------------------------------------------------
// 球员头像：本地化自 arsenal.com 球员页（2026-27 赛季阵容）
// 文件位于 public/players/{id}.png，由脚本从官网下载。
// 离队 / 无头像的球员（如 max-dowman）回退到默认占位图。
// ---------------------------------------------------------------

export const DEFAULT_PLAYER_PHOTO = "/players/default-avatar.svg";

export const PLAYER_PHOTOS: Record<string, string> = {
  "ben-white": "/players/ben-white.png",
  "bruno-guimaraes": "/players/bruno-guimaraes.png",
  "bukayo-saka": "/players/bukayo-saka.png",
  "christos-tzolis": "/players/christos-tzolis.png",
  "cristhian-mosquera": "/players/cristhian-mosquera.png",
  "david-raya": "/players/david-raya.png",
  "declan-rice": "/players/declan-rice.png",
  "eberechi-eze": "/players/eberechi-eze.png",
  "ezri-konsa": "/players/ezri-konsa.png",
  "gabriel-magalhaes": "/players/gabriel-magalhaes.png",
  "illan-meslier": "/players/illan-meslier.png",
  "jurrien-timber": "/players/jurrien-timber.png",
  "kai-havertz": "/players/kai-havertz.png",
  "kepa-arrizabalaga": "/players/kepa-arrizabalaga.png",
  "martin-odegaard": "/players/martin-odegaard.png",
  "martin-zubimendi": "/players/martin-zubimendi.png",
  "mikel-merino": "/players/mikel-merino.png",
  "myles-lewis-skelly": "/players/myles-lewis-skelly.png",
  "noni-madueke": "/players/noni-madueke.png",
  "piero-hincapie": "/players/piero-hincapie.png",
  "riccardo-calafiori": "/players/riccardo-calafiori.png",
  "viktor-gyokeres": "/players/viktor-gyokeres.png",
  "william-saliba": "/players/william-saliba.png",
};

export function getPlayerPhoto(id: string): string {
  return PLAYER_PHOTOS[id] ?? DEFAULT_PLAYER_PHOTO;
}
