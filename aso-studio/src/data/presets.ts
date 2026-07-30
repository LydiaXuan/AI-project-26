import { CompetitorInfo, AsoCopy, StoreScreenshot, Project } from '../types';

export const INITIAL_COMPETITORS: CompetitorInfo[] = [

  {
    id: 'comp-1',
    name: 'Cannon Demolition 3D',
    url: 'https://play.google.com/store/apps/details?id=com.physics.cannon.demolition3d',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    title: 'Cannon Demolition 3D: Destruction Puzzle',
    titleZh: '加农炮拆毁 3D：物理破坏解谜',
    shortDescription: 'Aim, shoot cannons, crush structures, and solve satisfying 3D physics demolition puzzles!',
    shortDescriptionZh: '瞄准开炮、摧毁建筑，体验爽快刺激的 3D 物理拆除解谜关卡！',
    longDescription: `🚀 Experience the ultimate physics demolition simulator! Aim your powerful 3D cannon, calculate the trajectory, and blast giant castles, towers, and ragdoll obstacles into fine dust.

🔥 CRUSH & DESTROY BUILDINGS
Blast through hundreds of destruction levels with realistic 3D physics! Every brick, wooden beam, and stone block collapses dynamically based on real gravity physics. Feel the immense thrill of watching colossal towers smash into pieces.

💥 SMASH WITH HIGH-POWER CANNONS
Unlock specialized cannon balls including explosive bombs, laser fireballs, magnetic crushers, and giant bowling shots. Blast weak structural joints to trigger chain-reaction demolition and achieve maximum score!

🎯 EASY TO PLAY, HARD TO MASTER
Simple one-finger touch controls make aiming intuitive, but solving complex physics puzzles requires strategy and precision trajectory planning. Can you destroy all targets with limited cannon ammo?

⭐ KEY FEATURES:
• 💣 Realistic 3D destruction physics engine with dynamic ragdoll simulation.
• 🎮 200+ challenging physics demolition levels to conquer.
• ⚡ Multiple cannon upgrades, explosive ammo, and power-up boosters.
• 🏆 Offline play supported — smash buildings anywhere, anytime without internet.
• ✨ Satisfying ASMR sound effects and hyper-smooth visual destruction effects.

👉 Download Cannon Demolition 3D today and master the art of 3D physics destruction!`,
    longDescriptionZh: `🚀 体验终极 3D 物理拆除模拟器！瞄准强力加农巨炮，精准计算弹道轨迹，将城堡、巨塔与木构建筑轰成碎片。

🔥 【爽快拆除 物理毁坏】
体验上百个基于真实 3D 物理引擎打造的破坏关卡！每一块砖头、木梁与石块都会根据重力物理呈现真实坍塌。享受巨塔轰然倒塌的震撼解压感！

💥 【解锁巨炮 炸裂技能】
解锁各种特种炮弹，包括高爆炸弹、激光火球、磁力毁灭弹和超大保龄重炮。击中结构弱点，触发连环爆破拆除，获取最高星级评分！

🎯 【单手操作 策略解谜】
单手极简滑动瞄准，上手容易但充满挑战。需要巧妙计算物理抛物线与重心弱点，用有限的炮弹数量摧毁全部目标！

⭐ 【游戏特色】
• 💣 真实 3D 物理毁坏引擎与 Ragdoll 傀儡物理模拟
• 🎮 200+ 充满挑战的物理爆破拆毁关卡
• ⚡ 多款加农炮升级、爆破弹药与辅助道具
• 🏆 支持单机离线游玩，随时随地享受解压拆楼
• ✨ 极具满足感的 ASMR 音效与流畅毁灭视觉特效

👉 立即下载《加农炮拆毁 3D》，成为物理爆破大师！`,
    downloads: '10,000,000+',
    rating: 4.6,
    category: 'Games > Puzzle',
    keywords: [
      { word: 'cannon', count: 8, density: 2.8, category: 'entity', translation: '加农炮' },
      { word: 'demolition', count: 7, density: 2.5, category: 'genre', translation: '拆除/爆破' },
      { word: 'physics', count: 6, density: 2.1, category: 'genre', translation: '物理' },
      { word: '3d', count: 7, density: 2.5, category: 'genre', translation: '3D' },
      { word: 'destruction', count: 5, density: 1.8, category: 'genre', translation: '毁坏' },
      { word: 'smash', count: 4, density: 1.4, category: 'action', translation: '粉碎' },
      { word: 'blast', count: 5, density: 1.8, category: 'action', translation: '轰炸' },
      { word: 'crush', count: 4, density: 1.4, category: 'action', translation: '碾碎' },
      { word: 'puzzle', count: 4, density: 1.4, category: 'genre', translation: '解谜' },
      { word: 'satisfying', count: 3, density: 1.1, category: 'emotion', translation: '解压/满足' },
      { word: 'thrill', count: 2, density: 0.7, category: 'emotion', translation: '爽快/刺激' }
    ],
    coreFeatures: [
      '真实 3D 刚体与物理重力坍塌引擎 (Realistic 3D Physics Collapses)',
      '多样化炮弹与爆破道具组合 (Specialized Cannons & Explosive Ammo)',
      '单手指抛物线瞄准极简操作 (One-finger Trajectory Aiming)',
      '离线单机无网流畅运行 (Offline Play Anywhere)'
    ],
    commonPoints: [
      '均突出 "3D Physics", "Demolition", "Satisfying", "Smash" 核心搜索词汇',
      '短描述普遍在 70-80 字符之间，第一句话点明核心玩法与爽感',
      '长描述多采用全大写分类标题 + 4-5 条结构化 Bullet Points，增强手机端快速浏览可读性'
    ],
    differentiationPoints: [
      '该竞品极度强调 ASMR 音效与解压心理满足 (Satisfying ASMR sound effects)',
      '突出离线无网支持 (Offline play) 吸引海外低网速地区用户下载'
    ]
  },
  {
    id: 'comp-2',
    name: 'Castle Crusher Physics 3D',
    url: 'https://play.google.com/store/apps/details?id=com.smash.castle.crusher.physics',
    iconUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80',
    title: 'Castle Crusher: Physics Smash',
    titleZh: '城堡粉碎者：物理摧毁',
    shortDescription: 'Shoot ball catapults, smash enemy castles, and enjoy high-speed 3D physical demolition!',
    shortDescriptionZh: '发射投石机，轰塌敌方城堡，体验高速 3D 物理毁坏拆除！',
    longDescription: `Master catapult destruction in Castle Crusher: Physics Smash! Command heavy catapults, crush enemy fortresses, and experience top-tier 3D trajectory physics.

EPIC CASTLE SMASHING
Load your catapult ball, pull back, and target the key pillar of giant medieval castles. Observe realistic brick physics demolition as structures collapse under heavy impact.

STRATEGIC PUZZLE LEVELS
Each castle is a clever physics puzzle. Find weak foundation points, detonate hidden explosive barrels, and knock down enemy ragdoll guards with minimum shots.

CUSTOMIZE YOUR CANNON & CATAPULT
Earn golden coins from demolition victories to upgrade ball firepower, increase trajectory accuracy, and unlock plasma blast cannons!

FEATURES:
- Realistic 3D trajectory physics and destruction collapse engine.
- Over 150 creative demolition levels with boss castle fights.
- Eye-catching 3D graphics with stress-relieving smash animations.
- Offline puzzle gameplay for instant fun anywhere.

Join millions of crushers and smash every castle to victory!`,
    longDescriptionZh: `在《城堡粉碎者：物理摧毁》中掌控投石爆破！操纵重型投石机与加农炮，摧毁敌方堡垒，体验顶尖 3D 抛物线物理毁坏。

【史诗城堡粉碎】
装填投石重炮，拉弓瞄准，轰击中世纪巨型城堡的关键支柱。观察真实砖块物理坍塌，感受重击下的爆破快感！

【策略物理关卡】
每个城堡都是精心设计的物理谜题。寻找建筑地基弱点，引爆隐藏炸药桶，用最少的弹药击倒敌方傀儡守卫！

【火炮与投石机升级】
通过拆楼胜利赢得金币，升级火炮威力、提升抛物线精度，并解锁等离子毁灭重炮！

【游戏亮点】
- 真实 3D 抛物线物理与建筑摧毁坍塌引擎
- 超过 150 个创意拆除关卡及 Boss 城堡挑战
- 炫目 3D 画质与超强解压粉碎动画
- 支持离线单机，随时随地开启解压狂欢

立即加入粉碎大军，将所有城堡轰成废墟！`,
    downloads: '5,000,000+',
    rating: 4.5,
    category: 'Games > Action',
    keywords: [
      { word: 'castle', count: 8, density: 2.9, category: 'entity', translation: '城堡' },
      { word: 'smash', count: 6, density: 2.2, category: 'action', translation: '粉碎' },
      { word: 'physics', count: 5, density: 1.8, category: 'genre', translation: '物理' },
      { word: 'crusher', count: 4, density: 1.4, category: 'entity', translation: '粉碎者' },
      { word: 'catapult', count: 4, density: 1.4, category: 'entity', translation: '投石机' },
      { word: 'demolition', count: 3, density: 1.1, category: 'genre', translation: '拆除' },
      { word: '3d', count: 4, density: 1.4, category: 'genre', translation: '3D' },
      { word: 'puzzle', count: 3, density: 1.1, category: 'genre', translation: '解谜' },
      { word: 'stress-relieving', count: 2, density: 0.7, category: 'emotion', translation: '解压' }
    ],
    coreFeatures: [
      '投石机与抛物线弹道物理 (Catapult Trajectory Physics)',
      '关卡地基爆破弱点机制 (Foundation Exploding Barrels)',
      'Boss 城堡大关卡拆除 (Boss Castle Demolition)'
    ],
    commonPoints: [
      '标题均限定在 30 字符以内',
      '强调粉碎/摧毁动作词（Smash, Crush, Blast）与物理词（Physics, Trajectory）',
      '包含 Boss 机制增加后续关卡留存'
    ],
    differentiationPoints: [
      '偏向中世纪投石机题材 (Catapult / Medieval Castle)',
      '加入了炸药桶 (Explosive Barrels) 连环引爆玩法'
    ]
  },
  {
    id: 'comp-3',
    name: 'Royal Smash 3D',
    url: 'https://play.google.com/store/apps/details?id=com.royal.smash.castle.physics3d',
    iconUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
    title: 'Royal Smash: Castle Physics 3D',
    titleZh: '皇家粉碎：3D 城堡物理解压',
    shortDescription: 'Smash royal castles with cannon balls, defeat kingdom guards, and solve 3D physics puzzles!',
    shortDescriptionZh: '开炮轰塌皇家城堡，摧毁王室守卫，体验爽快 3D 物理拆楼解谜！',
    longDescription: `👑 Welcome to Royal Smash: Castle Physics 3D! Master royal cannon ball artillery, demolish majestic castles block by block, and reclaim the king's crown in this ultimate physics destruction puzzle game.

🔥 SMASH ROYAL KINGDOM CASTLES
Aim your heavy catapult cannon at vulnerable stone arches, royal towers, and wooden fortresses. Watch as gravity physics collapse giant 3D royal structures into satisfying rubble!

💥 POWERFUL CANNONBALLS & ROYAL BOOSTERS
Unlock explosive royal cannonballs including Dragon Fire Bombs, Lightning Crackers, Giant Iron Balls, and Magnetic Crushers. Trigger dramatic chain reactions to clear tricky levels!

🎯 CLEVER PHYSICS PUZZLE LEVELS
Over 180 handcrafted 3D puzzle stages! Calculate firing trajectories, find structural weak spots, and knock out enemy ragdoll royal guards with precision shots.

⭐ KEY FEATURES:
• 👑 Realistic 3D rigid-body physics destruction with dynamic ragdoll simulation.
• 🏰 180+ challenging physics demolition levels set in medieval royal kingdoms.
• 💣 Multiple cannonball upgrades, explosive power-ups, and trajectory line predictors.
• 🏆 Offline play fully supported — smash royal castles anywhere without internet connection!
• ✨ Satisfying ASMR sound effects, high-frame-rate destruction, and haptic feedback.

👉 Download Royal Smash 3D now and start your royal demolition quest!`,
    longDescriptionZh: `👑 欢迎来到《皇家粉碎：3D 城堡物理解压》！掌控皇家加农重炮，逐块摧毁宏伟的城堡高塔，在这款终极物理爆破解谜游戏中重夺国王王冠。

🔥 【粉碎皇家城堡 体验极致解压】
将重型投石加农炮瞄准坚固石拱、皇家高塔与木质要塞。观察重力物理引擎驱动下的巨型 3D 皇家建筑崩塌过程！

💥 【解锁皇家特种炮弹 与爆破道具】
解锁多种皇家爆破炮弹，包括龙火炸弹、闪电雷弹、巨型铁球与磁力重炮。触发震撼的连环引爆连击！

🎯 【精妙关卡 策略抛物线解谜】
超过 180 个精心设计的 3D 物理谜题关卡！计算最佳抛物线发射角度，寻找建筑重心脆弱点，击倒全部王室傀儡守卫！

⭐ 【游戏特色】
• 👑 真实 3D 刚体物理毁坏引擎与 Ragdoll 傀儡物理模拟
• 🏰 180+ 充满挑战的中世纪皇家城堡物理爆破关卡
• 💣 多款加农炮升级、爆破弹药与弹道辅助指示线
• 🏆 支持单机离线游玩，随时随地享受拆楼解压
• ✨ 极其治愈的 ASMR 爆破音效与高帧率毁灭视觉特效

👉 立即下载《皇家粉碎 3D》，开启你的皇家拆楼冒险！`,
    downloads: '8,000,000+',
    rating: 4.7,
    category: 'Games > Puzzle',
    keywords: [
      { word: 'royal', count: 8, density: 2.8, category: 'entity', translation: '皇家/王室' },
      { word: 'smash', count: 7, density: 2.5, category: 'action', translation: '粉碎' },
      { word: 'castle', count: 7, density: 2.5, category: 'entity', translation: '城堡' },
      { word: 'physics', count: 6, density: 2.1, category: 'genre', translation: '物理' },
      { word: '3d', count: 6, density: 2.1, category: 'genre', translation: '3D' },
      { word: 'demolition', count: 4, density: 1.4, category: 'genre', translation: '拆除' },
      { word: 'cannon', count: 4, density: 1.4, category: 'entity', translation: '加农炮' },
      { word: 'puzzle', count: 4, density: 1.4, category: 'genre', translation: '解谜' },
      { word: 'satisfying', count: 3, density: 1.1, category: 'emotion', translation: '解压/满足' }
    ],
    coreFeatures: [
      '皇家中世纪城堡刚体物理坍塌 (Royal Castle Physics Collapse)',
      '多样化特种爆破炮弹与弹道预测 (Specialized Cannonballs & Trajectory)',
      '关卡重力弱点引爆与 Ragdoll 击倒 (Gravity Weakness & Ragdoll Knockout)'
    ],
    commonPoints: [
      '均采用 "Royal", "Castle", "Smash", "Physics" 核心高价值词',
      '短描述控制在 80 字符标准线，首句包含主控动词 Smash & Defeat',
      '长描述采用全大写分段 + Bullet Points + Emojis 高可读排版'
    ],
    differentiationPoints: [
      '融入中世纪皇家与国王宝库题材 (Royal Kingdom / King Castle)',
      '主打高清高帧率 ASMR 爆破碎屑与震动反馈 (ASMR & Haptic Feedback)'
    ]
  }
];

export const INITIAL_ASO_COPY: AsoCopy = {
  appName: 'Smash Cannon 3D: Physics Demolition',
  title: 'Smash Cannon 3D: Physics Puzzle', // Exactly 30 chars limit compliant
  shortDescription: 'Blast cannons, smash 3D physics towers, and conquer fun demolition puzzles!', // 80 chars
  longDescription: `Ready for the most thrilling 3D physics demolition game? Aim your high-power smash cannon, calculate the parabolic trajectory, and crush towering building blocks into satisfying pieces!

SMASH & DESTROY WITH REAL 3D PHYSICS
Experience next-gen destruction physics! Fire heavy cannon balls at vulnerable castle joints, beam supports, and wooden walls. Watch in awe as giant 3D structures collapse realistically under real gravitational physics.

EXPLOSIVE CANNON BALLS & BOOSTERS
Upgrade your artillery with high-explosive bombs, plasma lasers, and heavy crushing balls. Detonate TNT barrels to unleash chain-reaction demolitions and clear challenging levels with maximum efficiency.

CHALLENGING PHYSICS PUZZLE LEVELS
Over 200 handcrafted levels packed with clever physics puzzles! Analyze weight distribution, find structural weak spots, and knock down enemy ragdoll targets with limited ammo shots.

WHY YOU WILL LOVE SMASH CANNON 3D:
- Realistic 3D destruction physics engine with dynamic ragdoll responses.
- 200+ fun demolition puzzle levels with smooth difficulty progression.
- Powerful cannon upgrades, explosive ammo types, and trajectory predictors.
- Play offline anytime — no Wi-Fi or internet connection required!
- Super satisfying visual effects and immersive ASMR demolition sound design.

Download Smash Cannon 3D now and start smashing towers with ultimate physics power!`,
  targetKeywords: ['smash', 'cannon', 'physics', 'demolition', '3d', 'puzzle', 'blast', 'crush', 'tower', 'satisfying'],
  subGenre: 'Games > Puzzle / Games > Action'
};

export const INITIAL_SCREENSHOTS: StoreScreenshot[] = [
  {
    id: 'screen-1',
    titleZh: '真实 3D 物理毁坏引擎',
    titleEn: 'REALISTIC 3D PHYSICS DEMOLITION',
    subtitleZh: '精准计算抛物线 轰塌巨型高塔',
    subtitleEn: 'Calculate Trajectory & Collapse Giant Towers',
    bgColor: 'from-amber-600 to-red-700',
    mockType: 'demolition'
  },
  {
    id: 'screen-2',
    titleZh: '强力加农炮与爆破道具',
    titleEn: 'POWERFUL CANNONS & EXPLOSIVE AMMO',
    subtitleZh: '解锁高爆炸弹与激光巨炮 连环引爆',
    subtitleEn: 'Unlock Plasma Bombs & Trigger Chain Explosions',
    bgColor: 'from-blue-600 to-indigo-800',
    mockType: 'cannon'
  },
  {
    id: 'screen-3',
    titleZh: '200+ 趣味物理烧脑关卡',
    titleEn: '200+ FUN PHYSICS PUZZLE LEVELS',
    subtitleZh: '找准地基支点 用最少炮弹满星通关',
    subtitleEn: 'Find Structural Weak Spots & Win 3 Stars',
    bgColor: 'from-emerald-600 to-teal-800',
    mockType: 'levels'
  },
  {
    id: 'screen-4',
    titleZh: '畅快离线解压体验',
    titleEn: 'SATISFYING OFFLINE STRESS RELIEF',
    subtitleZh: '随时随地享受 ASMR 爆破与碎片倾泻',
    subtitleEn: 'Enjoy ASMR Blast Sound Effects Anywhere',
    bgColor: 'from-purple-600 to-pink-700',
    mockType: 'rewards'
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Smash Cannon 3D: Physics Puzzle',
    packageName: 'com.physics.cannon.smash3d',
    category: 'Games > Puzzle',
    updatedAt: '2026-07-28 18:30',
    targetKeywords: ['smash', 'cannon', 'physics', 'demolition', '3d', 'puzzle', 'blast', 'crush', 'tower', 'satisfying'],
    competitors: INITIAL_COMPETITORS,
    asoCopy: INITIAL_ASO_COPY
  },
  {
    id: 'proj-2',
    name: 'Zen Blast Match 3: Tile Puzzle',
    packageName: 'com.zen.tile.match3.blast',
    category: 'Games > Casual',
    updatedAt: '2026-07-27 14:15',
    targetKeywords: ['match 3', 'tile match', 'zen puzzle', 'relaxing', 'blast', 'triple tile', 'mind puzzle'],
    competitors: [
      {
        id: 'comp-zen-1',
        name: 'Tile Master 3D Classic',
        url: 'https://play.google.com/store/apps/details?id=com.tile.master3d.classic',
        iconUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&auto=format&fit=crop&q=80',
        title: 'Tile Master 3D: Matching Game',
        titleZh: '3D 叠叠消：休闲消除解谜',
        shortDescription: 'Match triple 3D tiles, clear board blocks, and enjoy relaxing brain puzzle games!',
        shortDescriptionZh: '匹配三连 3D 方块，消除盘面，体验轻松解压的烧脑消除关卡！',
        longDescription: `Match 3D tiles and challenge your brain! Connect identical fruits, animals, and objects to clear the puzzle board.

RELAX & MATCH TRIPLE TILES
Tap 3 same tiles into the slot. Clear all blocks before the slot fills up. Hundreds of zen levels designed to relieve daily stress.

KEY FEATURES:
- Beautiful 3D visual tile models.
- Power-up boosters: Undo, Shuffle, and Magnet.
- Offline support — play zen tile match anywhere!`,
        longDescriptionZh: `匹配 3D 方块，挑战你的大脑！连接相同的水果、动物与物品，清空拼图盘面。

【轻松匹配 三消解压】
点击 3 个相同的方块放入槽位。在槽位填满前消除所有方块。数百个禅意关卡助你释放日常压力。

【游戏特色】
- 精美 3D 视觉方块模型
- 强力道具：撤销、打乱与磁铁
- 支持离线单机，随时随地享受禅意消除！`,
        downloads: '20,000,000+',
        rating: 4.7,
        category: 'Games > Casual',
        keywords: [
          { word: 'tile', count: 8, density: 2.7, category: 'entity', translation: '方块' },
          { word: 'match', count: 7, density: 2.3, category: 'action', translation: '匹配' },
          { word: '3d', count: 5, density: 1.7, category: 'genre', translation: '3D' },
          { word: 'zen', count: 4, density: 1.3, category: 'emotion', translation: '禅意' },
          { word: 'puzzle', count: 4, density: 1.3, category: 'genre', translation: '解谜' },
          { word: 'relaxing', count: 3, density: 1.0, category: 'emotion', translation: '放松' }
        ],
        coreFeatures: ['3D 物品三消机制', '槽位容量限制策略', '离线禅意音乐'],
        commonPoints: ['标题均带 Tile / Match 核心词', '突出 Relaxing 与 Brain Training'],
        differentiationPoints: ['采用治愈系温和木纹与竹林视觉设计']
      }
    ],
    asoCopy: {
      appName: 'Zen Blast Match 3: Tile Puzzle',
      title: 'Zen Blast Match 3: Tile Puzzle',
      shortDescription: 'Match triple 3D tiles, clear blocks, and enjoy relaxing zen puzzle matching!',
      longDescription: `Relax your mind with Zen Blast Match 3! Match triple tiles, solve rewarding puzzles, and experience peaceful brain training.

CALMING TILE MATCHING
Find and connect 3 identical 3D items. Clear the board to unlock relaxing zen scenery and peaceful soundscapes.

FEATURES:
- Hundreds of zen triple match levels.
- Satisfying combo blasts and boosters.
- Play offline anytime with smooth touch controls.`,
      targetKeywords: ['match 3', 'tile', 'zen', 'puzzle', 'blast', 'relaxing', 'brain'],
      subGenre: 'Games > Casual / Games > Puzzle'
    }
  },
  {
    id: 'proj-3',
    name: 'Idle RPG Legend: Dungeon Hero',
    packageName: 'com.legend.idle.dungeon.rpg',
    category: 'Games > Role Playing',
    updatedAt: '2026-07-26 11:20',
    targetKeywords: ['idle rpg', 'dungeon', 'hero', 'afk', 'gacha', 'raid', 'legend'],
    competitors: [
      {
        id: 'comp-rpg-1',
        name: 'Dungeon AFK Heroes 3D',
        url: 'https://play.google.com/store/apps/details?id=com.dungeon.afk.heroes.rpg',
        iconUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&auto=format&fit=crop&q=80',
        title: 'Dungeon AFK: Idle RPG Legend',
        titleZh: '地牢 AFK：挂机放置传奇',
        shortDescription: 'Summon epic heroes, auto battle monster raids, and collect AFK dungeon loot rewards!',
        shortDescriptionZh: '召唤史诗英雄，自动挂机地牢讨伐，领取离线丰厚挂机宝箱！',
        longDescription: `Embark on an epic idle RPG adventure! Summon 100+ legendary heroes, form powerful squad formations, and raid dark dungeons automatically while you sleep.

AUTO BATTLES & AFK REWARDS
Your hero party fights 24/7! Log in anytime to claim massive golden chest rewards, legendary gear, and exp crystals.

EPIC HERO GACHA SUMMONS
Collect knight champions, shadow assassins, and mage wizards. Level up skills and dominate PvP arena ladder seasons!

GAME FEATURES:
- Hands-free idle gameplay with auto-battle system.
- 100+ collectible heroes with unique skill animations.
- Boss guild raids, endless tower floors, and global arena.`,
        longDescriptionZh: `开启史诗级挂机 RPG 冒险！召唤 100+ 史诗英雄，组建最强战术阵型，睡梦中也能自动刷爆地牢宝箱。

【自动战斗 离线挂机】
你的英雄小队 24 小时不停战斗！随时上线一键领取海量金币宝箱、史诗神装与经验水晶。

【史诗抽卡 英雄养成】
收集骑士、刺客与法师英雄。升级绝技，霸榜全球 PvP 竞技场赛季！

【游戏亮点】
- 护肝省心全自动战斗挂机系统
- 100+ 异界英雄与炫酷技能动画
- 公会 Boss 讨伐、无尽之塔与全球竞技场`,
        downloads: '5,000,000+',
        rating: 4.8,
        category: 'Games > Role Playing',
        keywords: [
          { word: 'idle', count: 8, density: 2.8, category: 'genre', translation: '挂机' },
          { word: 'rpg', count: 7, density: 2.4, category: 'genre', translation: '角色扮演' },
          { word: 'dungeon', count: 6, density: 2.1, category: 'entity', translation: '地牢' },
          { word: 'afk', count: 5, density: 1.7, category: 'action', translation: '离线挂机' },
          { word: 'hero', count: 5, density: 1.7, category: 'entity', translation: '英雄' },
          { word: 'legend', count: 4, density: 1.4, category: 'emotion', translation: '传奇' }
        ],
        coreFeatures: ['24/7 离线挂机宝箱收益', '100+ 英雄抽卡与属性相克', '公会 Boss 讨伐战'],
        commonPoints: ['标题均带 Idle / AFK / RPG 核心高频词', '强调离线不掉队、高福利免费连抽'],
        differentiationPoints: ['主打暗黑风地牢美术与极速自动加速挂机']
      }
    ],
    asoCopy: {
      appName: 'Idle RPG Legend: Dungeon Hero',
      title: 'Idle RPG Legend: Dungeon Hero',
      shortDescription: 'Summon epic heroes, auto battle dark dungeons, and claim free AFK rewards!',
      longDescription: `Master the ultimate idle RPG legend! Summon mythic champions, conquer dark dungeons automatically, and reap rich AFK rewards.

AFK REWARDS & AUTO BATTLES
Your heroes never stop fighting! Earn gold, gear, and exp even while offline.

SUMMON MYTHIC HEROES
Assemble knight, mage, and assassin champions. Level up skills and dominate raid bosses!`,
      targetKeywords: ['idle rpg', 'dungeon', 'hero', 'afk', 'gacha', 'raid', 'legend'],
      subGenre: 'Games > Role Playing'
    }
  }
];

