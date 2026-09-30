import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

const code = ts.transpileModule(
  fs.readFileSync(
    new URL("./SourcingRequestForm.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
function harness(props = {}, lang = "en", { deferredUpdates = false } = {}) {
  const hooks = [];
  const effects = [];
  const updates = [];
  let cursor = 0;
  let tree;
  let submit = async () => ({ id: 17 });
  const calls = [];
  const events = [];
  const countries = {
    en: { code: "ae", phoneCode: "+971", cities: ["Dubai"] },
    vi: { code: "vn", phoneCode: "+84", cities: ["Hanoi"] },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    crypto: { randomUUID: () => "test-request-key" },
    window: {
      location: {
        origin: "https://www.tarmeer.com",
        pathname: "/materials/products/15",
      },
    },
    require(name) {
      if (name === "react/jsx-runtime") return jsx;
      if (name === "react")
        return {
          useId: () => "form",
          useEffect: fn => effects.push(fn),
          useRef: (v) => {
            const i = cursor++;
            return (hooks[i] ??= { current: v });
          },
          useState: (v) => {
            const i = cursor++;
            if (!(i in hooks)) hooks[i] = typeof v === "function" ? v() : v;
            return [
              hooks[i],
              (x) => {
                const apply = () => { hooks[i] = typeof x === "function" ? x(hooks[i]) : x; };
                if (deferredUpdates) updates.push(apply);
                else apply();
              },
            ];
          },
        };
      if (name.endsWith("/api"))
        return {
          api: {
            request: async (...args) => {
              calls.push(args);
              return submit(...args);
            },
          },
        };
      if (name.endsWith("/materialsAnalytics")) return { trackMaterialEvent: () => {} };
      if (name.endsWith("/analytics"))
        return {
          trackContact: (x) => events.push(x),
          trackLead: (x) => events.push(x),
        };
      if (name.endsWith("/country"))
        return { countryFromLang: (x) => countries[x] };
      if (name.endsWith("/SiteLocaleContext"))
        return { useSiteLocale: () => ({ lang }) };
      if (name.endsWith("/phoneValidation"))
        return {
          validatePhone: (x) => (x.length === 9 ? null : "Invalid phone"),
          isPhoneComplete: (x) => x.length === 9,
          phoneDigitCount: () => 9,
        };
      throw new Error(name);
    },
  });
  function render() {
    cursor = 0;
    const wrapper = exports.default({
      variant: "quote",
      productId: 15,
      productTitle: "Chair",
      productModel: "C15",
      quantityUnit: "piece",
      supplierId: 8,
      ...props,
    });
    tree = wrapper.type(wrapper.props);
    return tree;
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const n of node) {
        const hit = find(predicate, n ?? null);
        if (hit) return hit;
      }
      return null;
    }
    if (predicate(node)) return node;
    return node.props?.children === undefined
      ? null
      : find(predicate, node.props.children);
  }
  function change(id, value) {
    const field = find((n) => n.props?.id === `form-${id}`);
    assert.ok(field, id);
    const input = { value };
    field.props.onChange({ target: input, currentTarget: input });
    render();
  }
  function ready() {
    change("name", "Alice");
    change("phone", "501234567");
  }
  render();
  return {
    render,
    flushEffects: () => { while (effects.length) effects.shift()(); },
    flushUpdates: () => { while (updates.length) updates.shift()(); render(); },
    find,
    change,
    ready,
    calls,
    events,
    setSubmit: (f) => {
      submit = f;
    },
    send: () =>
      find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }),
  };
}

test("quote carries selected product/model, unknown quantity and country; sends only once while pending", async () => {
  const h = harness();
  h.ready();
  let resolve;
  h.setSubmit(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const first = h.send();
  await h.send();
  assert.equal(h.calls.length, 1);
  const body = JSON.parse(h.calls[0][1].body);
  assert.equal(body.product_id, 15);
  assert.equal(body.supplier_profile_id, 8);
  assert.equal(body.product_model, "C15");
  assert.equal(body.quantity_unknown, true);
  assert.equal(body.quantity, undefined);
  assert.equal(body.country, "ae");
  assert.equal(h.calls[0][1].headers["x-country"], "ae");
  resolve({ id: 17 });
  await first;
  h.render();
  assert.ok(h.find((n) => n.props?.role === "status"));
  assert.equal(h.events.length, 2);
  assert.ok(
    h.events.every(
      (e) => e.content_name === "quote" && !JSON.stringify(e).includes("Alice"),
    ),
  );
});

test("network failure preserves draft and retry key; successful duplicate does not repeat analytics", async () => {
  const h = harness();
  h.ready();
  h.setSubmit(async () => {
    throw new Error("Network unavailable");
  });
  await h.send();
  h.render();
  assert.equal(h.find((n) => n.props?.id === "form-name").props.value, "Alice");
  assert.ok(h.find((n) => n.props?.role === "alert"));
  h.setSubmit(async () => ({ id: 99, duplicate: true }));
  await h.send();
  h.render();
  assert.equal(
    JSON.parse(h.calls[0][1].body).request_key,
    JSON.parse(h.calls[1][1].body).request_key,
  );
  assert.equal(h.events.length, 0);
});

test("known quantities require positive quantity and unit; furniture is never forced into area", async () => {
  const h = harness();
  h.ready();
  h.find(
    (n) => n.type === "input" && n.props.type === "checkbox",
  ).props.onChange({ target: { checked: false }, currentTarget: { checked: false } });
  h.render();
  assert.equal(h.find((n) => n.props?.type === "submit").props.disabled, true);
  h.change("quantity", "4");
  assert.equal(h.find((n) => n.props?.type === "submit").props.disabled, false);
  assert.equal(
    h.find((n) => n.props?.id === "form-area"),
    null,
  );
  await h.send();
  const body = JSON.parse(h.calls[0][1].body);
  assert.equal(body.quantity, 4);
  assert.equal(body.quantity_unit, "piece");
});

test("Vietnam submission uses VN country, city list and phone prefix", async () => {
  const h = harness({}, "vi");
  h.ready();
  h.change("city", "Hanoi");
  await h.send();
  const body = JSON.parse(h.calls[0][1].body);
  assert.equal(body.country, "vn");
  assert.equal(body.phone, "+84501234567");
  assert.equal(body.city, "Hanoi");
  assert.equal(h.calls[0][1].headers["x-country"], "vn");
});

test("visit receipt confirms only a request and every editable contact field has a label", () => {
  const h = harness({
    variant: "visit",
    productId: undefined,
    supplierId: undefined,
  });
  for (const field of ["name", "phone", "city", "date", "message"])
    assert.ok(
      h.find((n) => n.type === "label" && n.props.htmlFor === `form-${field}`),
    );
  assert.equal(
    h.find((n) => n.props?.id === "form-area"),
    null,
  );
});

test('successful receipt receives keyboard focus', async () => {
  const h = harness(); h.ready(); await h.send(); h.render();
  const receipt = h.find(n => n.props?.role === 'status');
  let focused = false;
  receipt.props.ref.current = { focus() { focused = true; } };
  h.flushEffects();
  assert.equal(receipt.props.tabIndex, -1);
  assert.equal(focused, true);
});


test('deferred state updates preserve captured text, phone, select and textarea values after controlled DOM restoration', () => {
  const h = harness({}, 'en', { deferredUpdates: true });
  for (const [field, entered, expected] of [
    ['name', 'Alice', 'Alice'],
    ['phone', '50 123 4567', '501234567'],
    ['city', 'Dubai', 'Dubai'],
    ['message', 'Four dining chairs', 'Four dining chairs'],
  ]) {
    const input = { value: entered };
    const event = { target: input, currentTarget: input };
    h.find(n => n.props?.id === `form-${field}`).props.onChange(event);
    // React may restore the controlled DOM before its queued updater executes.
    input.value = '';
    event.currentTarget = null;
  }
  h.flushUpdates();
  for (const [field, expected] of [['name', 'Alice'], ['phone', '501234567'], ['city', 'Dubai'], ['message', 'Four dining chairs']]) {
    assert.equal(h.find(n => n.props?.id === `form-${field}`).props.value, expected);
  }
});

test('checkboxes capture their boolean immediately even when state updates are deferred', () => {
  for (const [props, checked, expectedField] of [
    [{}, false, 'quantity'],
    [{ variant: 'sourcing', productId: undefined }, true, 'area'],
  ]) {
    const h = harness(props, 'en', { deferredUpdates: true });
    const checkbox = h.find(n => n.type === 'input' && n.props.type === 'checkbox');
    const input = { checked };
    const event = { target: input, currentTarget: input };
    checkbox.props.onChange(event);
    input.checked = !checked;
    event.currentTarget = null;
    h.flushUpdates();
    assert.ok(h.find(n => n.props?.id === `form-${expectedField}`));
    assert.equal(h.find(n => n.type === 'input' && n.props.type === 'checkbox').props.checked, checked);
  }
});
