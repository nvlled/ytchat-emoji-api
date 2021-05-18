export default function (name: string) {
  const self = {
    get: (key: string) => {
      try {
        const data = JSON.parse(localStorage[name]);
        if (typeof data !== "object") {
          return null;
        }
        return data[key];
      } catch (e) {
        return null;
      }
    },
    clear: (key: string) => {
      delete localStorage[name]?.[key];
    },
    set: (key: string, data: any) => {
      let obj = self.get(key);
      if (!obj || typeof obj !== "object") {
        obj = {};
      }
      obj[key] = data;
      localStorage[name] = JSON.stringify(obj);
    },
  };
  return self;
}
