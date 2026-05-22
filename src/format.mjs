const MEAL_PREFIXES = {
  lunch: "lunch_",
  supper: "supper_"
};

const MEAL_NAMES = {
  lunch: "午餐",
  supper: "晚餐"
};

const CATEGORY_ORDER = [
  "meat_or_fish_dish",
  "half_meat_dish",
  "egg_dish",
  "vegetable_dish",
  "staple_food",
  "local_flavours",
  "coarse_cereals",
  "pizza",
  "fruit",
  "drink",
  "chinese_style",
  "western_style",
  "western_cake",
  "eggs",
  "side_dish",
  "liquid_diet",
  "soup_congee"
];

const CATEGORY_NAMES = {
  meat_or_fish_dish: "荤菜",
  half_meat_dish: "半荤菜",
  egg_dish: "蛋类菜",
  vegetable_dish: "素菜",
  staple_food: "主食",
  local_flavours: "小吃",
  coarse_cereals: "杂粮",
  pizza: "披萨",
  fruit: "水果",
  drink: "饮品",
  chinese_style: "中式",
  western_style: "西式",
  western_cake: "西点",
  eggs: "蛋类",
  side_dish: "小菜",
  liquid_diet: "流食",
  soup_congee: "汤&粥"
};

function flattenRows(groups = []) {
  const rows = [];
  for (const group of groups) {
    const items = Array.isArray(group?.row) ? group.row : Array.isArray(group) ? group : [];
    for (const item of items) {
      if (item?.id && item.name_sc && item.name_sc !== "空占位") rows.push(item);
    }
  }
  return rows;
}

function formatDish(item) {
  const calorie = item.calorie ? ` ${item.calorie}` : "";
  return `${item.name_sc}${calorie}`;
}

export function extractMeal(menuData, meal) {
  const prefix = MEAL_PREFIXES[meal];
  if (!prefix) throw new Error(`未知餐别：${meal}`);

  return CATEGORY_ORDER
    .map((key) => {
      const items = flattenRows(menuData[`${prefix}${key}`]);
      return {
        key,
        name: CATEGORY_NAMES[key] || key,
        items
      };
    })
    .filter((section) => section.items.length > 0);
}

export function formatMenuMessage({ menu, meal, school, remark }) {
  const sections = extractMeal(menu.data, meal);
  const mealName = MEAL_NAMES[meal];
  const title = `${school}${remark ? ` ${remark}` : ""} ${menu.weekday}${mealName}`;
  const lines = [
    title,
    `${menu.date}｜${menu.data.title_date}｜week_id=${menu.week.id}`,
    ""
  ];

  if (sections.length === 0) {
    lines.push("今天暂未查询到对应菜单。");
  } else {
    for (const section of sections) {
      lines.push(`【${section.name}】${section.items.map(formatDish).join("、")}`);
    }
  }

  return lines.join("\n");
}
