function C1(n, a) {
  for (var i = 0; i < a.length; i++) {
    const o = a[i];
    if (typeof o != "string" && !Array.isArray(o)) {
      for (const s in o)
        if (s !== "default" && !(s in n)) {
          const c = Object.getOwnPropertyDescriptor(o, s);
          c &&
            Object.defineProperty(
              n,
              s,
              c.get ? c : { enumerable: !0, get: () => o[s] },
            );
        }
    }
  }
  return Object.freeze(
    Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }),
  );
}
(function () {
  const a = document.createElement("link").relList;
  if (a && a.supports && a.supports("modulepreload")) return;
  for (const s of document.querySelectorAll('link[rel="modulepreload"]')) o(s);
  new MutationObserver((s) => {
    for (const c of s)
      if (c.type === "childList")
        for (const d of c.addedNodes)
          d.tagName === "LINK" && d.rel === "modulepreload" && o(d);
  }).observe(document, { childList: !0, subtree: !0 });
  function i(s) {
    const c = {};
    return (
      s.integrity && (c.integrity = s.integrity),
      s.referrerPolicy && (c.referrerPolicy = s.referrerPolicy),
      s.crossOrigin === "use-credentials"
        ? (c.credentials = "include")
        : s.crossOrigin === "anonymous"
          ? (c.credentials = "omit")
          : (c.credentials = "same-origin"),
      c
    );
  }
  function o(s) {
    if (s.ep) return;
    s.ep = !0;
    const c = i(s);
    fetch(s.href, c);
  }
})();
function hg(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default")
    ? n.default
    : n;
}
var Sf = { exports: {} },
  Cl = {};
var kv;
function T1() {
  if (kv) return Cl;
  kv = 1;
  var n = Symbol.for("react.transitional.element"),
    a = Symbol.for("react.fragment");
  function i(o, s, c) {
    var d = null;
    if (
      (c !== void 0 && (d = "" + c),
      s.key !== void 0 && (d = "" + s.key),
      "key" in s)
    ) {
      c = {};
      for (var h in s) h !== "key" && (c[h] = s[h]);
    } else c = s;
    return (
      (s = c.ref),
      { $$typeof: n, type: o, key: d, ref: s !== void 0 ? s : null, props: c }
    );
  }
  return ((Cl.Fragment = a), (Cl.jsx = i), (Cl.jsxs = i), Cl);
}
var Qv;
function _1() {
  return (Qv || ((Qv = 1), (Sf.exports = T1())), Sf.exports);
}
var O = _1(),
  _a = class {
    constructor() {
      ((this.listeners = new Set()),
        (this.subscribe = this.subscribe.bind(this)));
    }
    subscribe(n) {
      return (
        this.listeners.add(n),
        this.onSubscribe(),
        () => {
          (this.listeners.delete(n), this.onUnsubscribe());
        }
      );
    }
    hasListeners() {
      return this.listeners.size > 0;
    }
    onSubscribe() {}
    onUnsubscribe() {}
  },
  A1 = class extends _a {
    #t;
    #e;
    #n;
    constructor() {
      (super(),
        (this.#n = (n) => {
          if (typeof window < "u" && window.addEventListener) {
            const a = () => n();
            return (
              window.addEventListener("visibilitychange", a, !1),
              () => {
                window.removeEventListener("visibilitychange", a);
              }
            );
          }
        }));
    }
    onSubscribe() {
      this.#e || this.setEventListener(this.#n);
    }
    onUnsubscribe() {
      this.hasListeners() || (this.#e?.(), (this.#e = void 0));
    }
    setEventListener(n) {
      ((this.#n = n),
        this.#e?.(),
        (this.#e = n((a) => {
          typeof a == "boolean" ? this.setFocused(a) : this.onFocus();
        })));
    }
    setFocused(n) {
      this.#t !== n && ((this.#t = n), this.onFocus());
    }
    onFocus() {
      const n = this.isFocused();
      this.listeners.forEach((a) => {
        a(n);
      });
    }
    isFocused() {
      return typeof this.#t == "boolean"
        ? this.#t
        : globalThis.document?.visibilityState !== "hidden";
    }
  },
  Ed = new A1(),
  R1 = {
    setTimeout: (n, a) => setTimeout(n, a),
    clearTimeout: (n) => clearTimeout(n),
    setInterval: (n, a) => setInterval(n, a),
    clearInterval: (n) => clearInterval(n),
  },
  M1 = class {
    #t = R1;
    #e = !1;
    setTimeoutProvider(n) {
      this.#t = n;
    }
    setTimeout(n, a) {
      return this.#t.setTimeout(n, a);
    }
    clearTimeout(n) {
      this.#t.clearTimeout(n);
    }
    setInterval(n, a) {
      return this.#t.setInterval(n, a);
    }
    clearInterval(n) {
      this.#t.clearInterval(n);
    }
  },
  Sa = new M1();
function N1(n) {
  setTimeout(n, 0);
}
var D1 = typeof window > "u" || "Deno" in globalThis;
function wt() {}
function j1(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function Gf(n) {
  return typeof n == "number" && n >= 0 && n !== 1 / 0;
}
function mg(n, a) {
  return Math.max(n + (a || 0) - Date.now(), 0);
}
function kr(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function un(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function Vv(n, a) {
  const {
    type: i = "all",
    exact: o,
    fetchStatus: s,
    predicate: c,
    queryKey: d,
    stale: h,
  } = n;
  if (d) {
    if (o) {
      if (a.queryHash !== Od(d, a.options)) return !1;
    } else if (!jl(a.queryKey, d)) return !1;
  }
  if (i !== "all") {
    const m = a.isActive();
    if ((i === "active" && !m) || (i === "inactive" && m)) return !1;
  }
  return !(
    (typeof h == "boolean" && a.isStale() !== h) ||
    (s && s !== a.state.fetchStatus) ||
    (c && !c(a))
  );
}
function Yv(n, a) {
  const { exact: i, status: o, predicate: s, mutationKey: c } = n;
  if (c) {
    if (!a.options.mutationKey) return !1;
    if (i) {
      if (Qr(a.options.mutationKey) !== Qr(c)) return !1;
    } else if (!jl(a.options.mutationKey, c)) return !1;
  }
  return !((o && a.state.status !== o) || (s && !s(a)));
}
function Od(n, a) {
  return (a?.queryKeyHashFn || Qr)(n);
}
function Qr(n) {
  return JSON.stringify(n, (a, i) =>
    Kf(i)
      ? Object.keys(i)
          .sort()
          .reduce((o, s) => ((o[s] = i[s]), o), {})
      : i,
  );
}
function jl(n, a) {
  return n === a
    ? !0
    : typeof n != typeof a
      ? !1
      : n && a && typeof n == "object" && typeof a == "object"
        ? Object.keys(a).every((i) => jl(n[i], a[i]))
        : !1;
}
var z1 = Object.prototype.hasOwnProperty;
function Cd(n, a, i = 0) {
  if (n === a) return n;
  if (i > 500) return a;
  const o = Gv(n) && Gv(a);
  if (!o && !(Kf(n) && Kf(a))) return a;
  const c = (o ? n : Object.keys(n)).length,
    d = o ? a : Object.keys(a),
    h = d.length,
    m = o ? new Array(h) : {};
  let p = 0;
  for (let g = 0; g < h; g++) {
    const v = o ? g : d[g],
      w = n[v],
      E = a[v];
    if (w === E) {
      ((m[v] = w), (o ? g < c : z1.call(n, v)) && p++);
      continue;
    }
    if (
      w === null ||
      E === null ||
      typeof w != "object" ||
      typeof E != "object"
    ) {
      m[v] = E;
      continue;
    }
    const C = Cd(w, E, i + 1);
    ((m[v] = C), C === w && p++);
  }
  return c === h && p === c ? n : m;
}
function zl(n, a) {
  if (!a || Object.keys(n).length !== Object.keys(a).length) return !1;
  for (const i in n) if (n[i] !== a[i]) return !1;
  return !0;
}
function Gv(n) {
  return Array.isArray(n) && n.length === Object.keys(n).length;
}
function Kf(n) {
  if (!Kv(n)) return !1;
  const a = n.constructor;
  if (a === void 0) return !0;
  const i = a.prototype;
  return !(
    !Kv(i) ||
    !i.hasOwnProperty("isPrototypeOf") ||
    Object.getPrototypeOf(n) !== Object.prototype
  );
}
function Kv(n) {
  return Object.prototype.toString.call(n) === "[object Object]";
}
function U1(n) {
  return new Promise((a) => {
    Sa.setTimeout(a, n);
  });
}
function Xf(n, a, i) {
  return typeof i.structuralSharing == "function"
    ? i.structuralSharing(n, a)
    : i.structuralSharing !== !1
      ? Cd(n, a)
      : a;
}
function L1(n, a, i = 0) {
  const o = [...n, a];
  return i && o.length > i ? o.slice(1) : o;
}
function H1(n, a, i = 0) {
  const o = [a, ...n];
  return i && o.length > i ? o.slice(0, -1) : o;
}
var Ft = Symbol();
function pg(n, a) {
  return !n.queryFn && a?.initialPromise
    ? () => a.initialPromise
    : !n.queryFn || n.queryFn === Ft
      ? () => Promise.reject(new Error(`Missing queryFn: '${n.queryHash}'`))
      : n.queryFn;
}
function Td(n, a) {
  return typeof n == "function" ? n(...a) : !!n;
}
function B1(n, a, i) {
  let o = !1,
    s;
  return (
    Object.defineProperty(n, "signal", {
      enumerable: !0,
      get: () => (
        (s ??= a()),
        o ||
          ((o = !0),
          s.aborted ? i() : s.addEventListener("abort", i, { once: !0 })),
        s
      ),
    }),
    n
  );
}
var Ul = (() => {
  let n = () => D1;
  return {
    isServer() {
      return n();
    },
    setIsServer(a) {
      n = a;
    },
  };
})();
function If() {
  let n, a;
  const i = new Promise((s, c) => {
    ((n = s), (a = c));
  });
  ((i.status = "pending"), i.catch(() => {}));
  function o(s) {
    (Object.assign(i, s), delete i.resolve, delete i.reject);
  }
  return (
    (i.resolve = (s) => {
      (o({ status: "fulfilled", value: s }), n(s));
    }),
    (i.reject = (s) => {
      (o({ status: "rejected", reason: s }), a(s));
    }),
    i
  );
}
var q1 = N1;
function P1() {
  let n = [],
    a = 0,
    i = (h) => {
      h();
    },
    o = (h) => {
      h();
    },
    s = q1;
  const c = (h) => {
      a
        ? n.push(h)
        : s(() => {
            i(h);
          });
    },
    d = () => {
      const h = n;
      ((n = []),
        h.length &&
          s(() => {
            o(() => {
              h.forEach((m) => {
                i(m);
              });
            });
          }));
    };
  return {
    batch: (h) => {
      let m;
      a++;
      try {
        m = h();
      } finally {
        (a--, a || d());
      }
      return m;
    },
    batchCalls:
      (h) =>
      (...m) => {
        c(() => {
          h(...m);
        });
      },
    schedule: c,
    setNotifyFunction: (h) => {
      i = h;
    },
    setBatchNotifyFunction: (h) => {
      o = h;
    },
    setScheduler: (h) => {
      s = h;
    },
  };
}
var Je = P1(),
  k1 = class extends _a {
    #t = !0;
    #e;
    #n;
    constructor() {
      (super(),
        (this.#n = (n) => {
          if (typeof window < "u" && window.addEventListener) {
            const a = () => n(!0),
              i = () => n(!1);
            return (
              window.addEventListener("online", a, !1),
              window.addEventListener("offline", i, !1),
              () => {
                (window.removeEventListener("online", a),
                  window.removeEventListener("offline", i));
              }
            );
          }
        }));
    }
    onSubscribe() {
      this.#e || this.setEventListener(this.#n);
    }
    onUnsubscribe() {
      this.hasListeners() || (this.#e?.(), (this.#e = void 0));
    }
    setEventListener(n) {
      ((this.#n = n), this.#e?.(), (this.#e = n(this.setOnline.bind(this))));
    }
    setOnline(n) {
      this.#t !== n &&
        ((this.#t = n),
        this.listeners.forEach((i) => {
          i(n);
        }));
    }
    isOnline() {
      return this.#t;
    }
  },
  Ns = new k1();
function Q1(n) {
  return Math.min(1e3 * 2 ** n, 3e4);
}
function vg(n) {
  return (n ?? "online") === "online" ? Ns.isOnline() : !0;
}
var Zf = class extends Error {
  constructor(n) {
    (super("CancelledError"),
      (this.revert = n?.revert),
      (this.silent = n?.silent));
  }
};
function yg(n) {
  let a = !1,
    i = 0,
    o;
  const s = If(),
    c = () => s.status !== "pending",
    d = (S) => {
      if (!c()) {
        const R = new Zf(S);
        (w(R), n.onCancel?.(R));
      }
    },
    h = () => {
      a = !0;
    },
    m = () => {
      a = !1;
    },
    p = () =>
      Ed.isFocused() &&
      (n.networkMode === "always" || Ns.isOnline()) &&
      n.canRun(),
    g = () => vg(n.networkMode) && n.canRun(),
    v = (S) => {
      c() || (o?.(), s.resolve(S));
    },
    w = (S) => {
      c() || (o?.(), s.reject(S));
    },
    E = () =>
      new Promise((S) => {
        ((o = (R) => {
          (c() || p()) && S(R);
        }),
          n.onPause?.());
      }).then(() => {
        ((o = void 0), c() || n.onContinue?.());
      }),
    C = () => {
      if (c()) return;
      let S;
      const R = i === 0 ? n.initialPromise : void 0;
      try {
        S = R ?? n.fn();
      } catch (M) {
        S = Promise.reject(M);
      }
      Promise.resolve(S)
        .then(v)
        .catch((M) => {
          if (c()) return;
          const j = n.retry ?? (Ul.isServer() ? 0 : 3),
            q = n.retryDelay ?? Q1,
            Z = typeof q == "function" ? q(i, M) : q,
            Q =
              j === !0 ||
              (typeof j == "number" && i < j) ||
              (typeof j == "function" && j(i, M));
          if (a || !Q) {
            w(M);
            return;
          }
          (i++,
            n.onFail?.(i, M),
            U1(Z)
              .then(() => (p() ? void 0 : E()))
              .then(() => {
                a ? w(M) : C();
              }));
        });
    };
  return {
    promise: s,
    status: () => s.status,
    cancel: d,
    continue: () => (o?.(), s),
    cancelRetry: h,
    continueRetry: m,
    canStart: g,
    start: () => (g() ? C() : E().then(C), s),
  };
}
var gg = class {
    #t;
    destroy() {
      this.clearGcTimeout();
    }
    scheduleGc() {
      (this.clearGcTimeout(),
        Gf(this.gcTime) &&
          (this.#t = Sa.setTimeout(() => {
            this.optionalRemove();
          }, this.gcTime)));
    }
    updateGcTime(n) {
      this.gcTime = Math.max(
        this.gcTime || 0,
        n ?? (Ul.isServer() ? 1 / 0 : 300 * 1e3),
      );
    }
    clearGcTimeout() {
      this.#t && (Sa.clearTimeout(this.#t), (this.#t = void 0));
    }
  },
  V1 = class extends gg {
    #t;
    #e;
    #n;
    #a;
    #r;
    #i;
    #l;
    constructor(n) {
      (super(),
        (this.#l = !1),
        (this.#i = n.defaultOptions),
        this.setOptions(n.options),
        (this.observers = []),
        (this.#a = n.client),
        (this.#n = this.#a.getQueryCache()),
        (this.queryKey = n.queryKey),
        (this.queryHash = n.queryHash),
        (this.#t = Iv(this.options)),
        (this.state = n.state ?? this.#t),
        this.scheduleGc());
    }
    get meta() {
      return this.options.meta;
    }
    get promise() {
      return this.#r?.promise;
    }
    setOptions(n) {
      if (
        ((this.options = { ...this.#i, ...n }),
        this.updateGcTime(this.options.gcTime),
        this.state && this.state.data === void 0)
      ) {
        const a = Iv(this.options);
        a.data !== void 0 &&
          (this.setState(Xv(a.data, a.dataUpdatedAt)), (this.#t = a));
      }
    }
    optionalRemove() {
      !this.observers.length &&
        this.state.fetchStatus === "idle" &&
        this.#n.remove(this);
    }
    setData(n, a) {
      const i = Xf(this.state.data, n, this.options);
      return (
        this.#s({
          data: i,
          type: "success",
          dataUpdatedAt: a?.updatedAt,
          manual: a?.manual,
        }),
        i
      );
    }
    setState(n, a) {
      this.#s({ type: "setState", state: n, setStateOptions: a });
    }
    cancel(n) {
      const a = this.#r?.promise;
      return (this.#r?.cancel(n), a ? a.then(wt).catch(wt) : Promise.resolve());
    }
    destroy() {
      (super.destroy(), this.cancel({ silent: !0 }));
    }
    get resetState() {
      return this.#t;
    }
    reset() {
      (this.destroy(), this.setState(this.resetState));
    }
    isActive() {
      return this.observers.some((n) => un(n.options.enabled, this) !== !1);
    }
    isDisabled() {
      return this.getObserversCount() > 0
        ? !this.isActive()
        : this.options.queryFn === Ft || !this.isFetched();
    }
    isFetched() {
      return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
    }
    isStatic() {
      return this.getObserversCount() > 0
        ? this.observers.some((n) => kr(n.options.staleTime, this) === "static")
        : !1;
    }
    isStale() {
      return this.getObserversCount() > 0
        ? this.observers.some((n) => n.getCurrentResult().isStale)
        : this.state.data === void 0 || this.state.isInvalidated;
    }
    isStaleByTime(n = 0) {
      return this.state.data === void 0
        ? !0
        : n === "static"
          ? !1
          : this.state.isInvalidated
            ? !0
            : !mg(this.state.dataUpdatedAt, n);
    }
    onFocus() {
      (this.observers
        .find((a) => a.shouldFetchOnWindowFocus())
        ?.refetch({ cancelRefetch: !1 }),
        this.#r?.continue());
    }
    onOnline() {
      (this.observers
        .find((a) => a.shouldFetchOnReconnect())
        ?.refetch({ cancelRefetch: !1 }),
        this.#r?.continue());
    }
    addObserver(n) {
      this.observers.includes(n) ||
        (this.observers.push(n),
        this.clearGcTimeout(),
        this.#n.notify({ type: "observerAdded", query: this, observer: n }));
    }
    removeObserver(n) {
      this.observers.includes(n) &&
        ((this.observers = this.observers.filter((a) => a !== n)),
        this.observers.length ||
          (this.#r &&
            (this.#l || this.#o()
              ? this.#r.cancel({ revert: !0 })
              : this.#r.cancelRetry()),
          this.scheduleGc()),
        this.#n.notify({ type: "observerRemoved", query: this, observer: n }));
    }
    getObserversCount() {
      return this.observers.length;
    }
    #o() {
      return (
        this.state.fetchStatus === "paused" && this.state.status === "pending"
      );
    }
    invalidate() {
      this.state.isInvalidated || this.#s({ type: "invalidate" });
    }
    async fetch(n, a) {
      if (
        this.state.fetchStatus !== "idle" &&
        this.#r?.status() !== "rejected"
      ) {
        if (this.state.data !== void 0 && a?.cancelRefetch)
          this.cancel({ silent: !0 });
        else if (this.#r) return (this.#r.continueRetry(), this.#r.promise);
      }
      if ((n && this.setOptions(n), !this.options.queryFn)) {
        const h = this.observers.find((m) => m.options.queryFn);
        h && this.setOptions(h.options);
      }
      const i = new AbortController(),
        o = (h) => {
          Object.defineProperty(h, "signal", {
            enumerable: !0,
            get: () => ((this.#l = !0), i.signal),
          });
        },
        s = () => {
          const h = pg(this.options, a),
            p = (() => {
              const g = {
                client: this.#a,
                queryKey: this.queryKey,
                meta: this.meta,
              };
              return (o(g), g);
            })();
          return (
            (this.#l = !1),
            this.options.persister ? this.options.persister(h, p, this) : h(p)
          );
        },
        d = (() => {
          const h = {
            fetchOptions: a,
            options: this.options,
            queryKey: this.queryKey,
            client: this.#a,
            state: this.state,
            fetchFn: s,
          };
          return (o(h), h);
        })();
      (this.options.behavior?.onFetch(d, this),
        (this.#e = this.state),
        (this.state.fetchStatus === "idle" ||
          this.state.fetchMeta !== d.fetchOptions?.meta) &&
          this.#s({ type: "fetch", meta: d.fetchOptions?.meta }),
        (this.#r = yg({
          initialPromise: a?.initialPromise,
          fn: d.fetchFn,
          onCancel: (h) => {
            (h instanceof Zf &&
              h.revert &&
              this.setState({ ...this.#e, fetchStatus: "idle" }),
              i.abort());
          },
          onFail: (h, m) => {
            this.#s({ type: "failed", failureCount: h, error: m });
          },
          onPause: () => {
            this.#s({ type: "pause" });
          },
          onContinue: () => {
            this.#s({ type: "continue" });
          },
          retry: d.options.retry,
          retryDelay: d.options.retryDelay,
          networkMode: d.options.networkMode,
          canRun: () => !0,
        })));
      try {
        const h = await this.#r.start();
        if (h === void 0)
          throw new Error(`${this.queryHash} data is undefined`);
        return (
          this.setData(h),
          this.#n.config.onSuccess?.(h, this),
          this.#n.config.onSettled?.(h, this.state.error, this),
          h
        );
      } catch (h) {
        if (h instanceof Zf) {
          if (h.silent) return this.#r.promise;
          if (h.revert) {
            if (this.state.data === void 0) throw h;
            return this.state.data;
          }
        }
        throw (
          this.#s({ type: "error", error: h }),
          this.#n.config.onError?.(h, this),
          this.#n.config.onSettled?.(this.state.data, h, this),
          h
        );
      } finally {
        this.scheduleGc();
      }
    }
    #s(n) {
      const a = (i) => {
        switch (n.type) {
          case "failed":
            return {
              ...i,
              fetchFailureCount: n.failureCount,
              fetchFailureReason: n.error,
            };
          case "pause":
            return { ...i, fetchStatus: "paused" };
          case "continue":
            return { ...i, fetchStatus: "fetching" };
          case "fetch":
            return {
              ...i,
              ...bg(i.data, this.options),
              fetchMeta: n.meta ?? null,
            };
          case "success":
            const o = {
              ...i,
              ...Xv(n.data, n.dataUpdatedAt),
              dataUpdateCount: i.dataUpdateCount + 1,
              ...(!n.manual && {
                fetchStatus: "idle",
                fetchFailureCount: 0,
                fetchFailureReason: null,
              }),
            };
            return ((this.#e = n.manual ? o : void 0), o);
          case "error":
            const s = n.error;
            return {
              ...i,
              error: s,
              errorUpdateCount: i.errorUpdateCount + 1,
              errorUpdatedAt: Date.now(),
              fetchFailureCount: i.fetchFailureCount + 1,
              fetchFailureReason: s,
              fetchStatus: "idle",
              status: "error",
              isInvalidated: !0,
            };
          case "invalidate":
            return { ...i, isInvalidated: !0 };
          case "setState":
            return { ...i, ...n.state };
        }
      };
      ((this.state = a(this.state)),
        Je.batch(() => {
          (this.observers.forEach((i) => {
            i.onQueryUpdate();
          }),
            this.#n.notify({ query: this, type: "updated", action: n }));
        }));
    }
  };
function bg(n, a) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: vg(a.networkMode) ? "fetching" : "paused",
    ...(n === void 0 && { error: null, status: "pending" }),
  };
}
function Xv(n, a) {
  return {
    data: n,
    dataUpdatedAt: a ?? Date.now(),
    error: null,
    isInvalidated: !1,
    status: "success",
  };
}
function Iv(n) {
  const a =
      typeof n.initialData == "function" ? n.initialData() : n.initialData,
    i = a !== void 0,
    o = i
      ? typeof n.initialDataUpdatedAt == "function"
        ? n.initialDataUpdatedAt()
        : n.initialDataUpdatedAt
      : 0;
  return {
    data: a,
    dataUpdateCount: 0,
    dataUpdatedAt: i ? (o ?? Date.now()) : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: !1,
    status: i ? "success" : "pending",
    fetchStatus: "idle",
  };
}
var kl = class extends _a {
  constructor(n, a) {
    (super(),
      (this.options = a),
      (this.#t = n),
      (this.#o = null),
      (this.#l = If()),
      this.bindMethods(),
      this.setOptions(a));
  }
  #t;
  #e = void 0;
  #n = void 0;
  #a = void 0;
  #r;
  #i;
  #l;
  #o;
  #s;
  #d;
  #h;
  #c;
  #f;
  #u;
  #m = new Set();
  bindMethods() {
    this.refetch = this.refetch.bind(this);
  }
  onSubscribe() {
    this.listeners.size === 1 &&
      (this.#e.addObserver(this),
      Zv(this.#e, this.options) ? this.#p() : this.updateResult(),
      this.#b());
  }
  onUnsubscribe() {
    this.hasListeners() || this.destroy();
  }
  shouldFetchOnReconnect() {
    return Ff(this.#e, this.options, this.options.refetchOnReconnect);
  }
  shouldFetchOnWindowFocus() {
    return Ff(this.#e, this.options, this.options.refetchOnWindowFocus);
  }
  destroy() {
    ((this.listeners = new Set()),
      this.#x(),
      this.#S(),
      this.#e.removeObserver(this));
  }
  setOptions(n) {
    const a = this.options,
      i = this.#e;
    if (
      ((this.options = this.#t.defaultQueryOptions(n)),
      this.options.enabled !== void 0 &&
        typeof this.options.enabled != "boolean" &&
        typeof this.options.enabled != "function" &&
        typeof un(this.options.enabled, this.#e) != "boolean")
    )
      throw new Error(
        "Expected enabled to be a boolean or a callback that returns a boolean",
      );
    (this.#w(),
      this.#e.setOptions(this.options),
      a._defaulted &&
        !zl(this.options, a) &&
        this.#t.getQueryCache().notify({
          type: "observerOptionsUpdated",
          query: this.#e,
          observer: this,
        }));
    const o = this.hasListeners();
    (o && Fv(this.#e, i, this.options, a) && this.#p(),
      this.updateResult(),
      o &&
        (this.#e !== i ||
          un(this.options.enabled, this.#e) !== un(a.enabled, this.#e) ||
          kr(this.options.staleTime, this.#e) !== kr(a.staleTime, this.#e)) &&
        this.#v());
    const s = this.#y();
    o &&
      (this.#e !== i ||
        un(this.options.enabled, this.#e) !== un(a.enabled, this.#e) ||
        s !== this.#u) &&
      this.#g(s);
  }
  getOptimisticResult(n) {
    const a = this.#t.getQueryCache().build(this.#t, n),
      i = this.createResult(a, n);
    return (
      G1(this, i) &&
        ((this.#a = i), (this.#i = this.options), (this.#r = this.#e.state)),
      i
    );
  }
  getCurrentResult() {
    return this.#a;
  }
  trackResult(n, a) {
    return new Proxy(n, {
      get: (i, o) => (
        this.trackProp(o),
        a?.(o),
        o === "promise" &&
          (this.trackProp("data"),
          !this.options.experimental_prefetchInRender &&
            this.#l.status === "pending" &&
            this.#l.reject(
              new Error(
                "experimental_prefetchInRender feature flag is not enabled",
              ),
            )),
        Reflect.get(i, o)
      ),
    });
  }
  trackProp(n) {
    this.#m.add(n);
  }
  getCurrentQuery() {
    return this.#e;
  }
  refetch({ ...n } = {}) {
    return this.fetch({ ...n });
  }
  fetchOptimistic(n) {
    const a = this.#t.defaultQueryOptions(n),
      i = this.#t.getQueryCache().build(this.#t, a);
    return i.fetch().then(() => this.createResult(i, a));
  }
  fetch(n) {
    return this.#p({ ...n, cancelRefetch: n.cancelRefetch ?? !0 }).then(
      () => (this.updateResult(), this.#a),
    );
  }
  #p(n) {
    this.#w();
    let a = this.#e.fetch(this.options, n);
    return (n?.throwOnError || (a = a.catch(wt)), a);
  }
  #v() {
    this.#x();
    const n = kr(this.options.staleTime, this.#e);
    if (Ul.isServer() || this.#a.isStale || !Gf(n)) return;
    const i = mg(this.#a.dataUpdatedAt, n) + 1;
    this.#c = Sa.setTimeout(() => {
      this.#a.isStale || this.updateResult();
    }, i);
  }
  #y() {
    return (
      (typeof this.options.refetchInterval == "function"
        ? this.options.refetchInterval(this.#e)
        : this.options.refetchInterval) ?? !1
    );
  }
  #g(n) {
    (this.#S(),
      (this.#u = n),
      !(
        Ul.isServer() ||
        un(this.options.enabled, this.#e) === !1 ||
        !Gf(this.#u) ||
        this.#u === 0
      ) &&
        (this.#f = Sa.setInterval(() => {
          (this.options.refetchIntervalInBackground || Ed.isFocused()) &&
            this.#p();
        }, this.#u)));
  }
  #b() {
    (this.#v(), this.#g(this.#y()));
  }
  #x() {
    this.#c && (Sa.clearTimeout(this.#c), (this.#c = void 0));
  }
  #S() {
    this.#f && (Sa.clearInterval(this.#f), (this.#f = void 0));
  }
  createResult(n, a) {
    const i = this.#e,
      o = this.options,
      s = this.#a,
      c = this.#r,
      d = this.#i,
      m = n !== i ? n.state : this.#n,
      { state: p } = n;
    let g = { ...p },
      v = !1,
      w;
    if (a._optimisticResults) {
      const U = this.hasListeners(),
        W = !U && Zv(n, a),
        ne = U && Fv(n, i, a, o);
      ((W || ne) && (g = { ...g, ...bg(p.data, n.options) }),
        a._optimisticResults === "isRestoring" && (g.fetchStatus = "idle"));
    }
    let { error: E, errorUpdatedAt: C, status: S } = g;
    w = g.data;
    let R = !1;
    if (a.placeholderData !== void 0 && w === void 0 && S === "pending") {
      let U;
      (s?.isPlaceholderData && a.placeholderData === d?.placeholderData
        ? ((U = s.data), (R = !0))
        : (U =
            typeof a.placeholderData == "function"
              ? a.placeholderData(this.#h?.state.data, this.#h)
              : a.placeholderData),
        U !== void 0 && ((S = "success"), (w = Xf(s?.data, U, a)), (v = !0)));
    }
    if (a.select && w !== void 0 && !R)
      if (s && w === c?.data && a.select === this.#s) w = this.#d;
      else
        try {
          ((this.#s = a.select),
            (w = a.select(w)),
            (w = Xf(s?.data, w, a)),
            (this.#d = w),
            (this.#o = null));
        } catch (U) {
          this.#o = U;
        }
    this.#o && ((E = this.#o), (w = this.#d), (C = Date.now()), (S = "error"));
    const M = g.fetchStatus === "fetching",
      j = S === "pending",
      q = S === "error",
      Z = j && M,
      Q = w !== void 0,
      N = {
        status: S,
        fetchStatus: g.fetchStatus,
        isPending: j,
        isSuccess: S === "success",
        isError: q,
        isInitialLoading: Z,
        isLoading: Z,
        data: w,
        dataUpdatedAt: g.dataUpdatedAt,
        error: E,
        errorUpdatedAt: C,
        failureCount: g.fetchFailureCount,
        failureReason: g.fetchFailureReason,
        errorUpdateCount: g.errorUpdateCount,
        isFetched: n.isFetched(),
        isFetchedAfterMount:
          g.dataUpdateCount > m.dataUpdateCount ||
          g.errorUpdateCount > m.errorUpdateCount,
        isFetching: M,
        isRefetching: M && !j,
        isLoadingError: q && !Q,
        isPaused: g.fetchStatus === "paused",
        isPlaceholderData: v,
        isRefetchError: q && Q,
        isStale: _d(n, a),
        refetch: this.refetch,
        promise: this.#l,
        isEnabled: un(a.enabled, n) !== !1,
      };
    if (this.options.experimental_prefetchInRender) {
      const U = N.data !== void 0,
        W = N.status === "error" && !U,
        ne = (oe) => {
          W ? oe.reject(N.error) : U && oe.resolve(N.data);
        },
        ae = () => {
          const oe = (this.#l = N.promise = If());
          ne(oe);
        },
        te = this.#l;
      switch (te.status) {
        case "pending":
          n.queryHash === i.queryHash && ne(te);
          break;
        case "fulfilled":
          (W || N.data !== te.value) && ae();
          break;
        case "rejected":
          (!W || N.error !== te.reason) && ae();
          break;
      }
    }
    return N;
  }
  updateResult() {
    const n = this.#a,
      a = this.createResult(this.#e, this.options);
    if (
      ((this.#r = this.#e.state),
      (this.#i = this.options),
      this.#r.data !== void 0 && (this.#h = this.#e),
      zl(a, n))
    )
      return;
    this.#a = a;
    const i = () => {
      if (!n) return !0;
      const { notifyOnChangeProps: o } = this.options,
        s = typeof o == "function" ? o() : o;
      if (s === "all" || (!s && !this.#m.size)) return !0;
      const c = new Set(s ?? this.#m);
      return (
        this.options.throwOnError && c.add("error"),
        Object.keys(this.#a).some((d) => {
          const h = d;
          return this.#a[h] !== n[h] && c.has(h);
        })
      );
    };
    this.#E({ listeners: i() });
  }
  #w() {
    const n = this.#t.getQueryCache().build(this.#t, this.options);
    if (n === this.#e) return;
    const a = this.#e;
    ((this.#e = n),
      (this.#n = n.state),
      this.hasListeners() && (a?.removeObserver(this), n.addObserver(this)));
  }
  onQueryUpdate() {
    (this.updateResult(), this.hasListeners() && this.#b());
  }
  #E(n) {
    Je.batch(() => {
      (n.listeners &&
        this.listeners.forEach((a) => {
          a(this.#a);
        }),
        this.#t
          .getQueryCache()
          .notify({ query: this.#e, type: "observerResultsUpdated" }));
    });
  }
};
function Y1(n, a) {
  return (
    un(a.enabled, n) !== !1 &&
    n.state.data === void 0 &&
    !(n.state.status === "error" && a.retryOnMount === !1)
  );
}
function Zv(n, a) {
  return Y1(n, a) || (n.state.data !== void 0 && Ff(n, a, a.refetchOnMount));
}
function Ff(n, a, i) {
  if (un(a.enabled, n) !== !1 && kr(a.staleTime, n) !== "static") {
    const o = typeof i == "function" ? i(n) : i;
    return o === "always" || (o !== !1 && _d(n, a));
  }
  return !1;
}
function Fv(n, a, i, o) {
  return (
    (n !== a || un(o.enabled, n) === !1) &&
    (!i.suspense || n.state.status !== "error") &&
    _d(n, i)
  );
}
function _d(n, a) {
  return un(a.enabled, n) !== !1 && n.isStaleByTime(kr(a.staleTime, n));
}
function G1(n, a) {
  return !zl(n.getCurrentResult(), a);
}
function Ds(n) {
  return {
    onFetch: (a, i) => {
      const o = a.options,
        s = a.fetchOptions?.meta?.fetchMore?.direction,
        c = a.state.data?.pages || [],
        d = a.state.data?.pageParams || [];
      let h = { pages: [], pageParams: [] },
        m = 0;
      const p = async () => {
        let g = !1;
        const v = (C) => {
            B1(
              C,
              () => a.signal,
              () => (g = !0),
            );
          },
          w = pg(a.options, a.fetchOptions),
          E = async (C, S, R) => {
            if (g) return Promise.reject();
            if (S == null && C.pages.length) return Promise.resolve(C);
            const j = (() => {
                const V = {
                  client: a.client,
                  queryKey: a.queryKey,
                  pageParam: S,
                  direction: R ? "backward" : "forward",
                  meta: a.options.meta,
                };
                return (v(V), V);
              })(),
              q = await w(j),
              { maxPages: Z } = a.options,
              Q = R ? H1 : L1;
            return {
              pages: Q(C.pages, q, Z),
              pageParams: Q(C.pageParams, S, Z),
            };
          };
        if (s && c.length) {
          const C = s === "backward",
            S = C ? xg : $f,
            R = { pages: c, pageParams: d },
            M = S(o, R);
          h = await E(R, M, C);
        } else {
          const C = n ?? c.length;
          do {
            const S = m === 0 ? (d[0] ?? o.initialPageParam) : $f(o, h);
            if (m > 0 && S == null) break;
            ((h = await E(h, S)), m++);
          } while (m < C);
        }
        return h;
      };
      a.options.persister
        ? (a.fetchFn = () =>
            a.options.persister?.(
              p,
              {
                client: a.client,
                queryKey: a.queryKey,
                meta: a.options.meta,
                signal: a.signal,
              },
              i,
            ))
        : (a.fetchFn = p);
    },
  };
}
function $f(n, { pages: a, pageParams: i }) {
  const o = a.length - 1;
  return a.length > 0 ? n.getNextPageParam(a[o], a, i[o], i) : void 0;
}
function xg(n, { pages: a, pageParams: i }) {
  return a.length > 0 ? n.getPreviousPageParam?.(a[0], a, i[0], i) : void 0;
}
function K1(n, a) {
  return a ? $f(n, a) != null : !1;
}
function X1(n, a) {
  return !a || !n.getPreviousPageParam ? !1 : xg(n, a) != null;
}
var Sg = class extends kl {
    constructor(n, a) {
      super(n, a);
    }
    bindMethods() {
      (super.bindMethods(),
        (this.fetchNextPage = this.fetchNextPage.bind(this)),
        (this.fetchPreviousPage = this.fetchPreviousPage.bind(this)));
    }
    setOptions(n) {
      super.setOptions({ ...n, behavior: Ds() });
    }
    getOptimisticResult(n) {
      return ((n.behavior = Ds()), super.getOptimisticResult(n));
    }
    fetchNextPage(n) {
      return this.fetch({
        ...n,
        meta: { fetchMore: { direction: "forward" } },
      });
    }
    fetchPreviousPage(n) {
      return this.fetch({
        ...n,
        meta: { fetchMore: { direction: "backward" } },
      });
    }
    createResult(n, a) {
      const { state: i } = n,
        o = super.createResult(n, a),
        { isFetching: s, isRefetching: c, isError: d, isRefetchError: h } = o,
        m = i.fetchMeta?.fetchMore?.direction,
        p = d && m === "forward",
        g = s && m === "forward",
        v = d && m === "backward",
        w = s && m === "backward";
      return {
        ...o,
        fetchNextPage: this.fetchNextPage,
        fetchPreviousPage: this.fetchPreviousPage,
        hasNextPage: K1(a, i.data),
        hasPreviousPage: X1(a, i.data),
        isFetchNextPageError: p,
        isFetchingNextPage: g,
        isFetchPreviousPageError: v,
        isFetchingPreviousPage: w,
        isRefetchError: h && !p && !v,
        isRefetching: c && !g && !w,
      };
    }
  },
  I1 = class extends gg {
    #t;
    #e;
    #n;
    #a;
    constructor(n) {
      (super(),
        (this.#t = n.client),
        (this.mutationId = n.mutationId),
        (this.#n = n.mutationCache),
        (this.#e = []),
        (this.state = n.state || wg()),
        this.setOptions(n.options),
        this.scheduleGc());
    }
    setOptions(n) {
      ((this.options = n), this.updateGcTime(this.options.gcTime));
    }
    get meta() {
      return this.options.meta;
    }
    addObserver(n) {
      this.#e.includes(n) ||
        (this.#e.push(n),
        this.clearGcTimeout(),
        this.#n.notify({ type: "observerAdded", mutation: this, observer: n }));
    }
    removeObserver(n) {
      ((this.#e = this.#e.filter((a) => a !== n)),
        this.scheduleGc(),
        this.#n.notify({
          type: "observerRemoved",
          mutation: this,
          observer: n,
        }));
    }
    optionalRemove() {
      this.#e.length ||
        (this.state.status === "pending"
          ? this.scheduleGc()
          : this.#n.remove(this));
    }
    continue() {
      return this.#a?.continue() ?? this.execute(this.state.variables);
    }
    async execute(n) {
      const a = () => {
          this.#r({ type: "continue" });
        },
        i = {
          client: this.#t,
          meta: this.options.meta,
          mutationKey: this.options.mutationKey,
        };
      this.#a = yg({
        fn: () =>
          this.options.mutationFn
            ? this.options.mutationFn(n, i)
            : Promise.reject(new Error("No mutationFn found")),
        onFail: (c, d) => {
          this.#r({ type: "failed", failureCount: c, error: d });
        },
        onPause: () => {
          this.#r({ type: "pause" });
        },
        onContinue: a,
        retry: this.options.retry ?? 0,
        retryDelay: this.options.retryDelay,
        networkMode: this.options.networkMode,
        canRun: () => this.#n.canRun(this),
      });
      const o = this.state.status === "pending",
        s = !this.#a.canStart();
      try {
        if (o) a();
        else {
          (this.#r({ type: "pending", variables: n, isPaused: s }),
            this.#n.config.onMutate &&
              (await this.#n.config.onMutate(n, this, i)));
          const d = await this.options.onMutate?.(n, i);
          d !== this.state.context &&
            this.#r({ type: "pending", context: d, variables: n, isPaused: s });
        }
        const c = await this.#a.start();
        return (
          await this.#n.config.onSuccess?.(c, n, this.state.context, this, i),
          await this.options.onSuccess?.(c, n, this.state.context, i),
          await this.#n.config.onSettled?.(
            c,
            null,
            this.state.variables,
            this.state.context,
            this,
            i,
          ),
          await this.options.onSettled?.(c, null, n, this.state.context, i),
          this.#r({ type: "success", data: c }),
          c
        );
      } catch (c) {
        try {
          await this.#n.config.onError?.(c, n, this.state.context, this, i);
        } catch (d) {
          Promise.reject(d);
        }
        try {
          await this.options.onError?.(c, n, this.state.context, i);
        } catch (d) {
          Promise.reject(d);
        }
        try {
          await this.#n.config.onSettled?.(
            void 0,
            c,
            this.state.variables,
            this.state.context,
            this,
            i,
          );
        } catch (d) {
          Promise.reject(d);
        }
        try {
          await this.options.onSettled?.(void 0, c, n, this.state.context, i);
        } catch (d) {
          Promise.reject(d);
        }
        throw (this.#r({ type: "error", error: c }), c);
      } finally {
        this.#n.runNext(this);
      }
    }
    #r(n) {
      const a = (i) => {
        switch (n.type) {
          case "failed":
            return {
              ...i,
              failureCount: n.failureCount,
              failureReason: n.error,
            };
          case "pause":
            return { ...i, isPaused: !0 };
          case "continue":
            return { ...i, isPaused: !1 };
          case "pending":
            return {
              ...i,
              context: n.context,
              data: void 0,
              failureCount: 0,
              failureReason: null,
              error: null,
              isPaused: n.isPaused,
              status: "pending",
              variables: n.variables,
              submittedAt: Date.now(),
            };
          case "success":
            return {
              ...i,
              data: n.data,
              failureCount: 0,
              failureReason: null,
              error: null,
              status: "success",
              isPaused: !1,
            };
          case "error":
            return {
              ...i,
              data: void 0,
              error: n.error,
              failureCount: i.failureCount + 1,
              failureReason: n.error,
              isPaused: !1,
              status: "error",
            };
        }
      };
      ((this.state = a(this.state)),
        Je.batch(() => {
          (this.#e.forEach((i) => {
            i.onMutationUpdate(n);
          }),
            this.#n.notify({ mutation: this, type: "updated", action: n }));
        }));
    }
  };
function wg() {
  return {
    context: void 0,
    data: void 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: !1,
    status: "idle",
    variables: void 0,
    submittedAt: 0,
  };
}
var Z1 = class extends _a {
  constructor(n = {}) {
    (super(),
      (this.config = n),
      (this.#t = new Set()),
      (this.#e = new Map()),
      (this.#n = 0));
  }
  #t;
  #e;
  #n;
  build(n, a, i) {
    const o = new I1({
      client: n,
      mutationCache: this,
      mutationId: ++this.#n,
      options: n.defaultMutationOptions(a),
      state: i,
    });
    return (this.add(o), o);
  }
  add(n) {
    this.#t.add(n);
    const a = fs(n);
    if (typeof a == "string") {
      const i = this.#e.get(a);
      i ? i.push(n) : this.#e.set(a, [n]);
    }
    this.notify({ type: "added", mutation: n });
  }
  remove(n) {
    if (this.#t.delete(n)) {
      const a = fs(n);
      if (typeof a == "string") {
        const i = this.#e.get(a);
        if (i)
          if (i.length > 1) {
            const o = i.indexOf(n);
            o !== -1 && i.splice(o, 1);
          } else i[0] === n && this.#e.delete(a);
      }
    }
    this.notify({ type: "removed", mutation: n });
  }
  canRun(n) {
    const a = fs(n);
    if (typeof a == "string") {
      const o = this.#e.get(a)?.find((s) => s.state.status === "pending");
      return !o || o === n;
    } else return !0;
  }
  runNext(n) {
    const a = fs(n);
    return typeof a == "string"
      ? (this.#e
          .get(a)
          ?.find((o) => o !== n && o.state.isPaused)
          ?.continue() ?? Promise.resolve())
      : Promise.resolve();
  }
  clear() {
    Je.batch(() => {
      (this.#t.forEach((n) => {
        this.notify({ type: "removed", mutation: n });
      }),
        this.#t.clear(),
        this.#e.clear());
    });
  }
  getAll() {
    return Array.from(this.#t);
  }
  find(n) {
    const a = { exact: !0, ...n };
    return this.getAll().find((i) => Yv(a, i));
  }
  findAll(n = {}) {
    return this.getAll().filter((a) => Yv(n, a));
  }
  notify(n) {
    Je.batch(() => {
      this.listeners.forEach((a) => {
        a(n);
      });
    });
  }
  resumePausedMutations() {
    const n = this.getAll().filter((a) => a.state.isPaused);
    return Je.batch(() => Promise.all(n.map((a) => a.continue().catch(wt))));
  }
};
function fs(n) {
  return n.options.scope?.id;
}
var F1 = class extends _a {
  #t;
  #e = void 0;
  #n;
  #a;
  constructor(a, i) {
    (super(), (this.#t = a), this.setOptions(i), this.bindMethods(), this.#r());
  }
  bindMethods() {
    ((this.mutate = this.mutate.bind(this)),
      (this.reset = this.reset.bind(this)));
  }
  setOptions(a) {
    const i = this.options;
    ((this.options = this.#t.defaultMutationOptions(a)),
      zl(this.options, i) ||
        this.#t.getMutationCache().notify({
          type: "observerOptionsUpdated",
          mutation: this.#n,
          observer: this,
        }),
      i?.mutationKey &&
      this.options.mutationKey &&
      Qr(i.mutationKey) !== Qr(this.options.mutationKey)
        ? this.reset()
        : this.#n?.state.status === "pending" &&
          this.#n.setOptions(this.options));
  }
  onUnsubscribe() {
    this.hasListeners() || this.#n?.removeObserver(this);
  }
  onMutationUpdate(a) {
    (this.#r(), this.#i(a));
  }
  getCurrentResult() {
    return this.#e;
  }
  reset() {
    (this.#n?.removeObserver(this), (this.#n = void 0), this.#r(), this.#i());
  }
  mutate(a, i) {
    return (
      (this.#a = i),
      this.#n?.removeObserver(this),
      (this.#n = this.#t.getMutationCache().build(this.#t, this.options)),
      this.#n.addObserver(this),
      this.#n.execute(a)
    );
  }
  #r() {
    const a = this.#n?.state ?? wg();
    this.#e = {
      ...a,
      isPending: a.status === "pending",
      isSuccess: a.status === "success",
      isError: a.status === "error",
      isIdle: a.status === "idle",
      mutate: this.mutate,
      reset: this.reset,
    };
  }
  #i(a) {
    Je.batch(() => {
      if (this.#a && this.hasListeners()) {
        const i = this.#e.variables,
          o = this.#e.context,
          s = {
            client: this.#t,
            meta: this.options.meta,
            mutationKey: this.options.mutationKey,
          };
        if (a?.type === "success") {
          try {
            this.#a.onSuccess?.(a.data, i, o, s);
          } catch (c) {
            Promise.reject(c);
          }
          try {
            this.#a.onSettled?.(a.data, null, i, o, s);
          } catch (c) {
            Promise.reject(c);
          }
        } else if (a?.type === "error") {
          try {
            this.#a.onError?.(a.error, i, o, s);
          } catch (c) {
            Promise.reject(c);
          }
          try {
            this.#a.onSettled?.(void 0, a.error, i, o, s);
          } catch (c) {
            Promise.reject(c);
          }
        }
      }
      this.listeners.forEach((i) => {
        i(this.#e);
      });
    });
  }
};
function $v(n, a) {
  const i = new Set(a);
  return n.filter((o) => !i.has(o));
}
function $1(n, a, i) {
  const o = n.slice(0);
  return ((o[a] = i), o);
}
var J1 = class extends _a {
    #t;
    #e;
    #n;
    #a;
    #r;
    #i;
    #l;
    #o;
    #s;
    #d = [];
    constructor(n, a, i) {
      (super(),
        (this.#t = n),
        (this.#a = i),
        (this.#n = []),
        (this.#r = []),
        (this.#e = []),
        this.setQueries(a));
    }
    onSubscribe() {
      this.listeners.size === 1 &&
        this.#r.forEach((n) => {
          n.subscribe((a) => {
            this.#u(n, a);
          });
        });
    }
    onUnsubscribe() {
      this.listeners.size || this.destroy();
    }
    destroy() {
      ((this.listeners = new Set()),
        this.#r.forEach((n) => {
          n.destroy();
        }));
    }
    setQueries(n, a) {
      ((this.#n = n),
        (this.#a = a),
        Je.batch(() => {
          const i = this.#r,
            o = this.#f(this.#n);
          o.forEach((g) => g.observer.setOptions(g.defaultedQueryOptions));
          const s = o.map((g) => g.observer),
            c = s.map((g) => g.getCurrentResult()),
            d = i.length !== s.length,
            h = s.some((g, v) => g !== i[v]),
            m = d || h,
            p = m
              ? !0
              : c.some((g, v) => {
                  const w = this.#e[v];
                  return !w || !zl(g, w);
                });
          (!m && !p) ||
            (m && ((this.#d = o), (this.#r = s)),
            (this.#e = c),
            this.hasListeners() &&
              (m &&
                ($v(i, s).forEach((g) => {
                  g.destroy();
                }),
                $v(s, i).forEach((g) => {
                  g.subscribe((v) => {
                    this.#u(g, v);
                  });
                })),
              this.#m()));
        }));
    }
    getCurrentResult() {
      return this.#e;
    }
    getQueries() {
      return this.#r.map((n) => n.getCurrentQuery());
    }
    getObservers() {
      return this.#r;
    }
    getOptimisticResult(n, a) {
      const i = this.#f(n),
        o = i.map((c) =>
          c.observer.getOptimisticResult(c.defaultedQueryOptions),
        ),
        s = i.map((c) => c.defaultedQueryOptions.queryHash);
      return [o, (c) => this.#c(c ?? o, a, s), () => this.#h(o, i)];
    }
    #h(n, a) {
      return a.map((i, o) => {
        const s = n[o];
        return i.defaultedQueryOptions.notifyOnChangeProps
          ? s
          : i.observer.trackResult(s, (c) => {
              a.forEach((d) => {
                d.observer.trackProp(c);
              });
            });
      });
    }
    #c(n, a, i) {
      if (a) {
        const o = this.#s,
          s =
            i !== void 0 &&
            o !== void 0 &&
            (o.length !== i.length || i.some((c, d) => c !== o[d]));
        return (
          (!this.#i || this.#e !== this.#o || s || a !== this.#l) &&
            ((this.#l = a),
            (this.#o = this.#e),
            i !== void 0 && (this.#s = i),
            (this.#i = Cd(this.#i, a(n)))),
          this.#i
        );
      }
      return n;
    }
    #f(n) {
      const a = new Map();
      this.#r.forEach((o) => {
        const s = o.options.queryHash;
        if (!s) return;
        const c = a.get(s);
        c ? c.push(o) : a.set(s, [o]);
      });
      const i = [];
      return (
        n.forEach((o) => {
          const s = this.#t.defaultQueryOptions(o),
            d = a.get(s.queryHash)?.shift() ?? new kl(this.#t, s);
          i.push({ defaultedQueryOptions: s, observer: d });
        }),
        i
      );
    }
    #u(n, a) {
      const i = this.#r.indexOf(n);
      i !== -1 && ((this.#e = $1(this.#e, i, a)), this.#m());
    }
    #m() {
      if (this.hasListeners()) {
        const n = this.#i,
          a = this.#h(this.#e, this.#d),
          i = this.#c(a, this.#a?.combine);
        n !== i &&
          Je.batch(() => {
            this.listeners.forEach((o) => {
              o(this.#e);
            });
          });
      }
    }
  },
  W1 = class extends _a {
    constructor(n = {}) {
      (super(), (this.config = n), (this.#t = new Map()));
    }
    #t;
    build(n, a, i) {
      const o = a.queryKey,
        s = a.queryHash ?? Od(o, a);
      let c = this.get(s);
      return (
        c ||
          ((c = new V1({
            client: n,
            queryKey: o,
            queryHash: s,
            options: n.defaultQueryOptions(a),
            state: i,
            defaultOptions: n.getQueryDefaults(o),
          })),
          this.add(c)),
        c
      );
    }
    add(n) {
      this.#t.has(n.queryHash) ||
        (this.#t.set(n.queryHash, n), this.notify({ type: "added", query: n }));
    }
    remove(n) {
      const a = this.#t.get(n.queryHash);
      a &&
        (n.destroy(),
        a === n && this.#t.delete(n.queryHash),
        this.notify({ type: "removed", query: n }));
    }
    clear() {
      Je.batch(() => {
        this.getAll().forEach((n) => {
          this.remove(n);
        });
      });
    }
    get(n) {
      return this.#t.get(n);
    }
    getAll() {
      return [...this.#t.values()];
    }
    find(n) {
      const a = { exact: !0, ...n };
      return this.getAll().find((i) => Vv(a, i));
    }
    findAll(n = {}) {
      const a = this.getAll();
      return Object.keys(n).length > 0 ? a.filter((i) => Vv(n, i)) : a;
    }
    notify(n) {
      Je.batch(() => {
        this.listeners.forEach((a) => {
          a(n);
        });
      });
    }
    onFocus() {
      Je.batch(() => {
        this.getAll().forEach((n) => {
          n.onFocus();
        });
      });
    }
    onOnline() {
      Je.batch(() => {
        this.getAll().forEach((n) => {
          n.onOnline();
        });
      });
    }
  },
  ew = class {
    #t;
    #e;
    #n;
    #a;
    #r;
    #i;
    #l;
    #o;
    constructor(n = {}) {
      ((this.#t = n.queryCache || new W1()),
        (this.#e = n.mutationCache || new Z1()),
        (this.#n = n.defaultOptions || {}),
        (this.#a = new Map()),
        (this.#r = new Map()),
        (this.#i = 0));
    }
    mount() {
      (this.#i++,
        this.#i === 1 &&
          ((this.#l = Ed.subscribe(async (n) => {
            n && (await this.resumePausedMutations(), this.#t.onFocus());
          })),
          (this.#o = Ns.subscribe(async (n) => {
            n && (await this.resumePausedMutations(), this.#t.onOnline());
          }))));
    }
    unmount() {
      (this.#i--,
        this.#i === 0 &&
          (this.#l?.(), (this.#l = void 0), this.#o?.(), (this.#o = void 0)));
    }
    isFetching(n) {
      return this.#t.findAll({ ...n, fetchStatus: "fetching" }).length;
    }
    isMutating(n) {
      return this.#e.findAll({ ...n, status: "pending" }).length;
    }
    getQueryData(n) {
      const a = this.defaultQueryOptions({ queryKey: n });
      return this.#t.get(a.queryHash)?.state.data;
    }
    ensureQueryData(n) {
      const a = this.defaultQueryOptions(n),
        i = this.#t.build(this, a),
        o = i.state.data;
      return o === void 0
        ? this.fetchQuery(n)
        : (n.revalidateIfStale &&
            i.isStaleByTime(kr(a.staleTime, i)) &&
            this.prefetchQuery(a),
          Promise.resolve(o));
    }
    getQueriesData(n) {
      return this.#t.findAll(n).map(({ queryKey: a, state: i }) => {
        const o = i.data;
        return [a, o];
      });
    }
    setQueryData(n, a, i) {
      const o = this.defaultQueryOptions({ queryKey: n }),
        c = this.#t.get(o.queryHash)?.state.data,
        d = j1(a, c);
      if (d !== void 0)
        return this.#t.build(this, o).setData(d, { ...i, manual: !0 });
    }
    setQueriesData(n, a, i) {
      return Je.batch(() =>
        this.#t
          .findAll(n)
          .map(({ queryKey: o }) => [o, this.setQueryData(o, a, i)]),
      );
    }
    getQueryState(n) {
      const a = this.defaultQueryOptions({ queryKey: n });
      return this.#t.get(a.queryHash)?.state;
    }
    removeQueries(n) {
      const a = this.#t;
      Je.batch(() => {
        a.findAll(n).forEach((i) => {
          a.remove(i);
        });
      });
    }
    resetQueries(n, a) {
      const i = this.#t;
      return Je.batch(
        () => (
          i.findAll(n).forEach((o) => {
            o.reset();
          }),
          this.refetchQueries({ type: "active", ...n }, a)
        ),
      );
    }
    cancelQueries(n, a = {}) {
      const i = { revert: !0, ...a },
        o = Je.batch(() => this.#t.findAll(n).map((s) => s.cancel(i)));
      return Promise.all(o).then(wt).catch(wt);
    }
    invalidateQueries(n, a = {}) {
      return Je.batch(
        () => (
          this.#t.findAll(n).forEach((i) => {
            i.invalidate();
          }),
          n?.refetchType === "none"
            ? Promise.resolve()
            : this.refetchQueries(
                { ...n, type: n?.refetchType ?? n?.type ?? "active" },
                a,
              )
        ),
      );
    }
    refetchQueries(n, a = {}) {
      const i = { ...a, cancelRefetch: a.cancelRefetch ?? !0 },
        o = Je.batch(() =>
          this.#t
            .findAll(n)
            .filter((s) => !s.isDisabled() && !s.isStatic())
            .map((s) => {
              let c = s.fetch(void 0, i);
              return (
                i.throwOnError || (c = c.catch(wt)),
                s.state.fetchStatus === "paused" ? Promise.resolve() : c
              );
            }),
        );
      return Promise.all(o).then(wt);
    }
    fetchQuery(n) {
      const a = this.defaultQueryOptions(n);
      a.retry === void 0 && (a.retry = !1);
      const i = this.#t.build(this, a);
      return i.isStaleByTime(kr(a.staleTime, i))
        ? i.fetch(a)
        : Promise.resolve(i.state.data);
    }
    prefetchQuery(n) {
      return this.fetchQuery(n).then(wt).catch(wt);
    }
    fetchInfiniteQuery(n) {
      return ((n.behavior = Ds(n.pages)), this.fetchQuery(n));
    }
    prefetchInfiniteQuery(n) {
      return this.fetchInfiniteQuery(n).then(wt).catch(wt);
    }
    ensureInfiniteQueryData(n) {
      return ((n.behavior = Ds(n.pages)), this.ensureQueryData(n));
    }
    resumePausedMutations() {
      return Ns.isOnline()
        ? this.#e.resumePausedMutations()
        : Promise.resolve();
    }
    getQueryCache() {
      return this.#t;
    }
    getMutationCache() {
      return this.#e;
    }
    getDefaultOptions() {
      return this.#n;
    }
    setDefaultOptions(n) {
      this.#n = n;
    }
    setQueryDefaults(n, a) {
      this.#a.set(Qr(n), { queryKey: n, defaultOptions: a });
    }
    getQueryDefaults(n) {
      const a = [...this.#a.values()],
        i = {};
      return (
        a.forEach((o) => {
          jl(n, o.queryKey) && Object.assign(i, o.defaultOptions);
        }),
        i
      );
    }
    setMutationDefaults(n, a) {
      this.#r.set(Qr(n), { mutationKey: n, defaultOptions: a });
    }
    getMutationDefaults(n) {
      const a = [...this.#r.values()],
        i = {};
      return (
        a.forEach((o) => {
          jl(n, o.mutationKey) && Object.assign(i, o.defaultOptions);
        }),
        i
      );
    }
    defaultQueryOptions(n) {
      if (n._defaulted) return n;
      const a = {
        ...this.#n.queries,
        ...this.getQueryDefaults(n.queryKey),
        ...n,
        _defaulted: !0,
      };
      return (
        a.queryHash || (a.queryHash = Od(a.queryKey, a)),
        a.refetchOnReconnect === void 0 &&
          (a.refetchOnReconnect = a.networkMode !== "always"),
        a.throwOnError === void 0 && (a.throwOnError = !!a.suspense),
        !a.networkMode && a.persister && (a.networkMode = "offlineFirst"),
        a.queryFn === Ft && (a.enabled = !1),
        a
      );
    }
    defaultMutationOptions(n) {
      return n?._defaulted
        ? n
        : {
            ...this.#n.mutations,
            ...(n?.mutationKey && this.getMutationDefaults(n.mutationKey)),
            ...n,
            _defaulted: !0,
          };
    }
    clear() {
      (this.#t.clear(), this.#e.clear());
    }
  },
  wf = { exports: {} },
  Se = {};
var Jv;
function tw() {
  if (Jv) return Se;
  Jv = 1;
  var n = Symbol.for("react.transitional.element"),
    a = Symbol.for("react.portal"),
    i = Symbol.for("react.fragment"),
    o = Symbol.for("react.strict_mode"),
    s = Symbol.for("react.profiler"),
    c = Symbol.for("react.consumer"),
    d = Symbol.for("react.context"),
    h = Symbol.for("react.forward_ref"),
    m = Symbol.for("react.suspense"),
    p = Symbol.for("react.memo"),
    g = Symbol.for("react.lazy"),
    v = Symbol.for("react.activity"),
    w = Symbol.iterator;
  function E(T) {
    return T === null || typeof T != "object"
      ? null
      : ((T = (w && T[w]) || T["@@iterator"]),
        typeof T == "function" ? T : null);
  }
  var C = {
      isMounted: function () {
        return !1;
      },
      enqueueForceUpdate: function () {},
      enqueueReplaceState: function () {},
      enqueueSetState: function () {},
    },
    S = Object.assign,
    R = {};
  function M(T, G, k) {
    ((this.props = T),
      (this.context = G),
      (this.refs = R),
      (this.updater = k || C));
  }
  ((M.prototype.isReactComponent = {}),
    (M.prototype.setState = function (T, G) {
      if (typeof T != "object" && typeof T != "function" && T != null)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables.",
        );
      this.updater.enqueueSetState(this, T, G, "setState");
    }),
    (M.prototype.forceUpdate = function (T) {
      this.updater.enqueueForceUpdate(this, T, "forceUpdate");
    }));
  function j() {}
  j.prototype = M.prototype;
  function q(T, G, k) {
    ((this.props = T),
      (this.context = G),
      (this.refs = R),
      (this.updater = k || C));
  }
  var Z = (q.prototype = new j());
  ((Z.constructor = q), S(Z, M.prototype), (Z.isPureReactComponent = !0));
  var Q = Array.isArray;
  function V() {}
  var N = { H: null, A: null, T: null, S: null },
    U = Object.prototype.hasOwnProperty;
  function W(T, G, k) {
    var I = k.ref;
    return {
      $$typeof: n,
      type: T,
      key: G,
      ref: I !== void 0 ? I : null,
      props: k,
    };
  }
  function ne(T, G) {
    return W(T.type, G, T.props);
  }
  function ae(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function te(T) {
    var G = { "=": "=0", ":": "=2" };
    return (
      "$" +
      T.replace(/[=:]/g, function (k) {
        return G[k];
      })
    );
  }
  var oe = /\/+/g;
  function se(T, G) {
    return typeof T == "object" && T !== null && T.key != null
      ? te("" + T.key)
      : G.toString(36);
  }
  function ce(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (
          (typeof T.status == "string"
            ? T.then(V, V)
            : ((T.status = "pending"),
              T.then(
                function (G) {
                  T.status === "pending" &&
                    ((T.status = "fulfilled"), (T.value = G));
                },
                function (G) {
                  T.status === "pending" &&
                    ((T.status = "rejected"), (T.reason = G));
                },
              )),
          T.status)
        ) {
          case "fulfilled":
            return T.value;
          case "rejected":
            throw T.reason;
        }
    }
    throw T;
  }
  function A(T, G, k, I, ee) {
    var ue = typeof T;
    (ue === "undefined" || ue === "boolean") && (T = null);
    var re = !1;
    if (T === null) re = !0;
    else
      switch (ue) {
        case "bigint":
        case "string":
        case "number":
          re = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case a:
              re = !0;
              break;
            case g:
              return ((re = T._init), A(re(T._payload), G, k, I, ee));
          }
      }
    if (re)
      return (
        (ee = ee(T)),
        (re = I === "" ? "." + se(T, 0) : I),
        Q(ee)
          ? ((k = ""),
            re != null && (k = re.replace(oe, "$&/") + "/"),
            A(ee, G, k, "", function (Oe) {
              return Oe;
            }))
          : ee != null &&
            (ae(ee) &&
              (ee = ne(
                ee,
                k +
                  (ee.key == null || (T && T.key === ee.key)
                    ? ""
                    : ("" + ee.key).replace(oe, "$&/") + "/") +
                  re,
              )),
            G.push(ee)),
        1
      );
    re = 0;
    var de = I === "" ? "." : I + ":";
    if (Q(T))
      for (var pe = 0; pe < T.length; pe++)
        ((I = T[pe]), (ue = de + se(I, pe)), (re += A(I, G, k, ue, ee)));
    else if (((pe = E(T)), typeof pe == "function"))
      for (T = pe.call(T), pe = 0; !(I = T.next()).done; )
        ((I = I.value), (ue = de + se(I, pe++)), (re += A(I, G, k, ue, ee)));
    else if (ue === "object") {
      if (typeof T.then == "function") return A(ce(T), G, k, I, ee);
      throw (
        (G = String(T)),
        Error(
          "Objects are not valid as a React child (found: " +
            (G === "[object Object]"
              ? "object with keys {" + Object.keys(T).join(", ") + "}"
              : G) +
            "). If you meant to render a collection of children, use an array instead.",
        )
      );
    }
    return re;
  }
  function B(T, G, k) {
    if (T == null) return T;
    var I = [],
      ee = 0;
    return (
      A(T, I, "", "", function (ue) {
        return G.call(k, ue, ee++);
      }),
      I
    );
  }
  function K(T) {
    if (T._status === -1) {
      var G = T._result;
      ((G = G()),
        G.then(
          function (k) {
            (T._status === 0 || T._status === -1) &&
              ((T._status = 1), (T._result = k));
          },
          function (k) {
            (T._status === 0 || T._status === -1) &&
              ((T._status = 2), (T._result = k));
          },
        ),
        T._status === -1 && ((T._status = 0), (T._result = G)));
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var le =
      typeof reportError == "function"
        ? reportError
        : function (T) {
            if (
              typeof window == "object" &&
              typeof window.ErrorEvent == "function"
            ) {
              var G = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof T == "object" &&
                  T !== null &&
                  typeof T.message == "string"
                    ? String(T.message)
                    : String(T),
                error: T,
              });
              if (!window.dispatchEvent(G)) return;
            } else if (
              typeof process == "object" &&
              typeof process.emit == "function"
            ) {
              process.emit("uncaughtException", T);
              return;
            }
            console.error(T);
          },
    J = {
      map: B,
      forEach: function (T, G, k) {
        B(
          T,
          function () {
            G.apply(this, arguments);
          },
          k,
        );
      },
      count: function (T) {
        var G = 0;
        return (
          B(T, function () {
            G++;
          }),
          G
        );
      },
      toArray: function (T) {
        return (
          B(T, function (G) {
            return G;
          }) || []
        );
      },
      only: function (T) {
        if (!ae(T))
          throw Error(
            "React.Children.only expected to receive a single React element child.",
          );
        return T;
      },
    };
  return (
    (Se.Activity = v),
    (Se.Children = J),
    (Se.Component = M),
    (Se.Fragment = i),
    (Se.Profiler = s),
    (Se.PureComponent = q),
    (Se.StrictMode = o),
    (Se.Suspense = m),
    (Se.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = N),
    (Se.__COMPILER_RUNTIME = {
      __proto__: null,
      c: function (T) {
        return N.H.useMemoCache(T);
      },
    }),
    (Se.cache = function (T) {
      return function () {
        return T.apply(null, arguments);
      };
    }),
    (Se.cacheSignal = function () {
      return null;
    }),
    (Se.cloneElement = function (T, G, k) {
      if (T == null)
        throw Error(
          "The argument must be a React element, but you passed " + T + ".",
        );
      var I = S({}, T.props),
        ee = T.key;
      if (G != null)
        for (ue in (G.key !== void 0 && (ee = "" + G.key), G))
          !U.call(G, ue) ||
            ue === "key" ||
            ue === "__self" ||
            ue === "__source" ||
            (ue === "ref" && G.ref === void 0) ||
            (I[ue] = G[ue]);
      var ue = arguments.length - 2;
      if (ue === 1) I.children = k;
      else if (1 < ue) {
        for (var re = Array(ue), de = 0; de < ue; de++)
          re[de] = arguments[de + 2];
        I.children = re;
      }
      return W(T.type, ee, I);
    }),
    (Se.createContext = function (T) {
      return (
        (T = {
          $$typeof: d,
          _currentValue: T,
          _currentValue2: T,
          _threadCount: 0,
          Provider: null,
          Consumer: null,
        }),
        (T.Provider = T),
        (T.Consumer = { $$typeof: c, _context: T }),
        T
      );
    }),
    (Se.createElement = function (T, G, k) {
      var I,
        ee = {},
        ue = null;
      if (G != null)
        for (I in (G.key !== void 0 && (ue = "" + G.key), G))
          U.call(G, I) &&
            I !== "key" &&
            I !== "__self" &&
            I !== "__source" &&
            (ee[I] = G[I]);
      var re = arguments.length - 2;
      if (re === 1) ee.children = k;
      else if (1 < re) {
        for (var de = Array(re), pe = 0; pe < re; pe++)
          de[pe] = arguments[pe + 2];
        ee.children = de;
      }
      if (T && T.defaultProps)
        for (I in ((re = T.defaultProps), re))
          ee[I] === void 0 && (ee[I] = re[I]);
      return W(T, ue, ee);
    }),
    (Se.createRef = function () {
      return { current: null };
    }),
    (Se.forwardRef = function (T) {
      return { $$typeof: h, render: T };
    }),
    (Se.isValidElement = ae),
    (Se.lazy = function (T) {
      return { $$typeof: g, _payload: { _status: -1, _result: T }, _init: K };
    }),
    (Se.memo = function (T, G) {
      return { $$typeof: p, type: T, compare: G === void 0 ? null : G };
    }),
    (Se.startTransition = function (T) {
      var G = N.T,
        k = {};
      N.T = k;
      try {
        var I = T(),
          ee = N.S;
        (ee !== null && ee(k, I),
          typeof I == "object" &&
            I !== null &&
            typeof I.then == "function" &&
            I.then(V, le));
      } catch (ue) {
        le(ue);
      } finally {
        (G !== null && k.types !== null && (G.types = k.types), (N.T = G));
      }
    }),
    (Se.unstable_useCacheRefresh = function () {
      return N.H.useCacheRefresh();
    }),
    (Se.use = function (T) {
      return N.H.use(T);
    }),
    (Se.useActionState = function (T, G, k) {
      return N.H.useActionState(T, G, k);
    }),
    (Se.useCallback = function (T, G) {
      return N.H.useCallback(T, G);
    }),
    (Se.useContext = function (T) {
      return N.H.useContext(T);
    }),
    (Se.useDebugValue = function () {}),
    (Se.useDeferredValue = function (T, G) {
      return N.H.useDeferredValue(T, G);
    }),
    (Se.useEffect = function (T, G) {
      return N.H.useEffect(T, G);
    }),
    (Se.useEffectEvent = function (T) {
      return N.H.useEffectEvent(T);
    }),
    (Se.useId = function () {
      return N.H.useId();
    }),
    (Se.useImperativeHandle = function (T, G, k) {
      return N.H.useImperativeHandle(T, G, k);
    }),
    (Se.useInsertionEffect = function (T, G) {
      return N.H.useInsertionEffect(T, G);
    }),
    (Se.useLayoutEffect = function (T, G) {
      return N.H.useLayoutEffect(T, G);
    }),
    (Se.useMemo = function (T, G) {
      return N.H.useMemo(T, G);
    }),
    (Se.useOptimistic = function (T, G) {
      return N.H.useOptimistic(T, G);
    }),
    (Se.useReducer = function (T, G, k) {
      return N.H.useReducer(T, G, k);
    }),
    (Se.useRef = function (T) {
      return N.H.useRef(T);
    }),
    (Se.useState = function (T) {
      return N.H.useState(T);
    }),
    (Se.useSyncExternalStore = function (T, G, k) {
      return N.H.useSyncExternalStore(T, G, k);
    }),
    (Se.useTransition = function () {
      return N.H.useTransition();
    }),
    (Se.version = "19.2.4"),
    Se
  );
}
var Wv;
function Qs() {
  return (Wv || ((Wv = 1), (wf.exports = tw())), wf.exports);
}
var b = Qs();
const ie = hg(b),
  Ql = C1({ __proto__: null, default: ie }, [b]);
var Eg = b.createContext(void 0),
  Vl = (n) => {
    const a = b.useContext(Eg);
    if (n) return n;
    if (!a)
      throw new Error("No QueryClient set, use QueryClientProvider to set one");
    return a;
  },
  nw = ({ client: n, children: a }) => (
    b.useEffect(
      () => (
        n.mount(),
        () => {
          n.unmount();
        }
      ),
      [n],
    ),
    O.jsx(Eg.Provider, { value: n, children: a })
  ),
  Og = b.createContext(!1),
  Cg = () => b.useContext(Og);
Og.Provider;
function rw() {
  let n = !1;
  return {
    clearReset: () => {
      n = !1;
    },
    reset: () => {
      n = !0;
    },
    isReset: () => n,
  };
}
var aw = b.createContext(rw()),
  Tg = () => b.useContext(aw),
  _g = (n, a, i) => {
    const o =
      i?.state.error && typeof n.throwOnError == "function"
        ? Td(n.throwOnError, [i.state.error, i])
        : n.throwOnError;
    (n.suspense || n.experimental_prefetchInRender || o) &&
      (a.isReset() || (n.retryOnMount = !1));
  },
  Ag = (n) => {
    b.useEffect(() => {
      n.clearReset();
    }, [n]);
  },
  Rg = ({
    result: n,
    errorResetBoundary: a,
    throwOnError: i,
    query: o,
    suspense: s,
  }) =>
    n.isError &&
    !a.isReset() &&
    !n.isFetching &&
    o &&
    ((s && n.data === void 0) || Td(i, [n.error, o])),
  Ad = (n, a) => a.state.data === void 0,
  Mg = (n) => {
    if (n.suspense) {
      const i = (s) => (s === "static" ? s : Math.max(s ?? 1e3, 1e3)),
        o = n.staleTime;
      ((n.staleTime = typeof o == "function" ? (...s) => i(o(...s)) : i(o)),
        typeof n.gcTime == "number" && (n.gcTime = Math.max(n.gcTime, 1e3)));
    }
  },
  iw = (n, a) => n.isLoading && n.isFetching && !a,
  Jf = (n, a) => n?.suspense && a.isPending,
  Wf = (n, a, i) =>
    a.fetchOptimistic(n).catch(() => {
      i.clearReset();
    });
function Ng({ queries: n, ...a }, i) {
  const o = Vl(i),
    s = Cg(),
    c = Tg(),
    d = b.useMemo(
      () =>
        n.map((S) => {
          const R = o.defaultQueryOptions(S);
          return ((R._optimisticResults = s ? "isRestoring" : "optimistic"), R);
        }),
      [n, o, s],
    );
  (d.forEach((S) => {
    Mg(S);
    const R = o.getQueryCache().get(S.queryHash);
    _g(S, c, R);
  }),
    Ag(c));
  const [h] = b.useState(() => new J1(o, d, a)),
    [m, p, g] = h.getOptimisticResult(d, a.combine),
    v = !s && a.subscribed !== !1;
  (b.useSyncExternalStore(
    b.useCallback((S) => (v ? h.subscribe(Je.batchCalls(S)) : wt), [h, v]),
    () => h.getCurrentResult(),
    () => h.getCurrentResult(),
  ),
    b.useEffect(() => {
      h.setQueries(d, a);
    }, [d, a, h]));
  const E = m.some((S, R) => Jf(d[R], S))
    ? m.flatMap((S, R) => {
        const M = d[R];
        if (M && Jf(M, S)) {
          const j = new kl(o, M);
          return Wf(M, j, c);
        }
        return [];
      })
    : [];
  if (E.length > 0) throw Promise.all(E);
  const C = m.find((S, R) => {
    const M = d[R];
    return (
      M &&
      Rg({
        result: S,
        errorResetBoundary: c,
        throwOnError: M.throwOnError,
        query: o.getQueryCache().get(M.queryHash),
        suspense: M.suspense,
      })
    );
  });
  if (C?.error) throw C.error;
  return p(g());
}
function Vs(n, a, i) {
  const o = Cg(),
    s = Tg(),
    c = Vl(i),
    d = c.defaultQueryOptions(n);
  c.getDefaultOptions().queries?._experimental_beforeQuery?.(d);
  const h = c.getQueryCache().get(d.queryHash);
  ((d._optimisticResults = o ? "isRestoring" : "optimistic"),
    Mg(d),
    _g(d, s, h),
    Ag(s));
  const m = !c.getQueryCache().get(d.queryHash),
    [p] = b.useState(() => new a(c, d)),
    g = p.getOptimisticResult(d),
    v = !o && n.subscribed !== !1;
  if (
    (b.useSyncExternalStore(
      b.useCallback(
        (w) => {
          const E = v ? p.subscribe(Je.batchCalls(w)) : wt;
          return (p.updateResult(), E);
        },
        [p, v],
      ),
      () => p.getCurrentResult(),
      () => p.getCurrentResult(),
    ),
    b.useEffect(() => {
      p.setOptions(d);
    }, [d, p]),
    Jf(d, g))
  )
    throw Wf(d, p, s);
  if (
    Rg({
      result: g,
      errorResetBoundary: s,
      throwOnError: d.throwOnError,
      query: h,
      suspense: d.suspense,
    })
  )
    throw g.error;
  return (
    c.getDefaultOptions().queries?._experimental_afterQuery?.(d, g),
    d.experimental_prefetchInRender &&
      !Ul.isServer() &&
      iw(g, o) &&
      (m ? Wf(d, p, s) : h?.promise)?.catch(wt).finally(() => {
        p.updateResult();
      }),
    d.notifyOnChangeProps ? g : p.trackResult(g)
  );
}
function lw(n, a) {
  return Vs(n, kl, a);
}
function ow(n, a) {
  return Vs(
    {
      ...n,
      enabled: !0,
      suspense: !0,
      throwOnError: Ad,
      placeholderData: void 0,
    },
    kl,
    a,
  );
}
function sw(n, a) {
  return Vs({ ...n, enabled: !0, suspense: !0, throwOnError: Ad }, Sg, a);
}
function uw(n, a) {
  return Ng(
    {
      ...n,
      queries: n.queries.map((i) => ({
        ...i,
        suspense: !0,
        throwOnError: Ad,
        enabled: !0,
        placeholderData: void 0,
      })),
    },
    a,
  );
}
function cw(n, a) {
  const i = Vl(a);
  i.getQueryState(n.queryKey) || i.prefetchQuery(n);
}
function fw(n, a) {
  const i = Vl(a);
  i.getQueryState(n.queryKey) || i.prefetchInfiniteQuery(n);
}
function dw(n, a) {
  const i = Vl(a),
    [o] = b.useState(() => new F1(i, n));
  b.useEffect(() => {
    o.setOptions(n);
  }, [o, n]);
  const s = b.useSyncExternalStore(
      b.useCallback((d) => o.subscribe(Je.batchCalls(d)), [o]),
      () => o.getCurrentResult(),
      () => o.getCurrentResult(),
    ),
    c = b.useCallback(
      (d, h) => {
        o.mutate(d, h).catch(wt);
      },
      [o],
    );
  if (s.error && Td(o.options.throwOnError, [s.error])) throw s.error;
  return { ...s, mutate: c, mutateAsync: s.mutate };
}
function hw(n, a) {
  return Vs(n, Sg, a);
}
function wa(n) {
  return !!n && !Array.isArray(n) && typeof n == "object";
}
function mw() {
  return Object.create(null);
}
const pw = typeof Symbol == "function" && !!Symbol.asyncIterator;
function Dg(n) {
  return pw && wa(n) && Symbol.asyncIterator in n;
}
var vw = Object.create,
  jg = Object.defineProperty,
  yw = Object.getOwnPropertyDescriptor,
  zg = Object.getOwnPropertyNames,
  gw = Object.getPrototypeOf,
  bw = Object.prototype.hasOwnProperty,
  Yl = (n, a) =>
    function () {
      return (
        a || (0, n[zg(n)[0]])((a = { exports: {} }).exports, a),
        a.exports
      );
    },
  xw = (n, a, i, o) => {
    if ((a && typeof a == "object") || typeof a == "function")
      for (var s = zg(a), c = 0, d = s.length, h; c < d; c++)
        ((h = s[c]),
          !bw.call(n, h) &&
            h !== i &&
            jg(n, h, {
              get: ((m) => a[m]).bind(null, h),
              enumerable: !(o = yw(a, h)) || o.enumerable,
            }));
    return n;
  },
  Ys = (n, a, i) => (
    (i = n != null ? vw(gw(n)) : {}),
    xw(jg(i, "default", { value: n, enumerable: !0 }), n)
  );
const Ug = () => {},
  ey = (n) => {
    Object.freeze && Object.freeze(n);
  };
function Lg(n, a, i) {
  var o;
  const s = a.join(".");
  return (
    ((o = i[s]) !== null && o !== void 0) ||
      (i[s] = new Proxy(Ug, {
        get(c, d) {
          if (!(typeof d != "string" || d === "then"))
            return Lg(n, [...a, d], i);
        },
        apply(c, d, h) {
          const m = a[a.length - 1];
          let p = { args: h, path: a };
          return (
            m === "call"
              ? (p = {
                  args: h.length >= 2 ? [h[1]] : [],
                  path: a.slice(0, -1),
                })
              : m === "apply" &&
                (p = { args: h.length >= 2 ? h[1] : [], path: a.slice(0, -1) }),
            ey(p.args),
            ey(p.path),
            n(p)
          );
        },
      })),
    i[s]
  );
}
const Gs = (n) => Lg(n, [], mw()),
  Rd = (n) =>
    new Proxy(Ug, {
      get(a, i) {
        if (i !== "then") return n(i);
      },
    });
var Hg = Yl({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/typeof.js"(
      n,
      a,
    ) {
      function i(o) {
        "@babel/helpers - typeof";
        return (
          (a.exports = i =
            typeof Symbol == "function" && typeof Symbol.iterator == "symbol"
              ? function (s) {
                  return typeof s;
                }
              : function (s) {
                  return s &&
                    typeof Symbol == "function" &&
                    s.constructor === Symbol &&
                    s !== Symbol.prototype
                    ? "symbol"
                    : typeof s;
                }),
          (a.exports.__esModule = !0),
          (a.exports.default = a.exports),
          i(o)
        );
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Sw = Yl({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPrimitive.js"(
      n,
      a,
    ) {
      var i = Hg().default;
      function o(s, c) {
        if (i(s) != "object" || !s) return s;
        var d = s[Symbol.toPrimitive];
        if (d !== void 0) {
          var h = d.call(s, c || "default");
          if (i(h) != "object") return h;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (c === "string" ? String : Number)(s);
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  ww = Yl({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPropertyKey.js"(
      n,
      a,
    ) {
      var i = Hg().default,
        o = Sw();
      function s(c) {
        var d = o(c, "string");
        return i(d) == "symbol" ? d : d + "";
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Bg = Yl({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/defineProperty.js"(
      n,
      a,
    ) {
      var i = ww();
      function o(s, c, d) {
        return (
          (c = i(c)) in s
            ? Object.defineProperty(s, c, {
                value: d,
                enumerable: !0,
                configurable: !0,
                writable: !0,
              })
            : (s[c] = d),
          s
        );
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Md = Yl({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectSpread2.js"(
      n,
      a,
    ) {
      var i = Bg();
      function o(c, d) {
        var h = Object.keys(c);
        if (Object.getOwnPropertySymbols) {
          var m = Object.getOwnPropertySymbols(c);
          (d &&
            (m = m.filter(function (p) {
              return Object.getOwnPropertyDescriptor(c, p).enumerable;
            })),
            h.push.apply(h, m));
        }
        return h;
      }
      function s(c) {
        for (var d = 1; d < arguments.length; d++) {
          var h = arguments[d] != null ? arguments[d] : {};
          d % 2
            ? o(Object(h), !0).forEach(function (m) {
                i(c, m, h[m]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(c, Object.getOwnPropertyDescriptors(h))
              : o(Object(h)).forEach(function (m) {
                  Object.defineProperty(
                    c,
                    m,
                    Object.getOwnPropertyDescriptor(h, m),
                  );
                });
        }
        return c;
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  });
Ys(Md());
Ys(Bg());
var ds = Ys(Md());
function Ew(n, a) {
  if ("error" in n) {
    const o = a.deserialize(n.error);
    return {
      ok: !1,
      error: (0, ds.default)((0, ds.default)({}, n), {}, { error: o }),
    };
  }
  return {
    ok: !0,
    result: (0, ds.default)(
      (0, ds.default)({}, n.result),
      (!n.result.type || n.result.type === "data") && {
        type: "data",
        data: a.deserialize(n.result.data),
      },
    ),
  };
}
var Ef = class extends Error {
  constructor() {
    super("Unable to transform response from server");
  }
};
function Ow(n, a) {
  let i;
  try {
    i = Ew(n, a);
  } catch {
    throw new Ef();
  }
  if (!i.ok && (!wa(i.error.error) || typeof i.error.error.code != "number"))
    throw new Ef();
  if (i.ok && !wa(i.result)) throw new Ef();
  return i;
}
Ys(Md());
function Ks(n) {
  const a = {
    subscribe(i) {
      let o = null,
        s = !1,
        c = !1,
        d = !1;
      function h() {
        if (o === null) {
          d = !0;
          return;
        }
        c || ((c = !0), typeof o == "function" ? o() : o && o.unsubscribe());
      }
      return (
        (o = n({
          next(m) {
            var p;
            s || (p = i.next) === null || p === void 0 || p.call(i, m);
          },
          error(m) {
            var p;
            s ||
              ((s = !0),
              (p = i.error) === null || p === void 0 || p.call(i, m),
              h());
          },
          complete() {
            var m;
            s ||
              ((s = !0),
              (m = i.complete) === null || m === void 0 || m.call(i),
              h());
          },
        })),
        d && h(),
        { unsubscribe: h }
      );
    },
    pipe(...i) {
      return i.reduce(Cw, a);
    },
  };
  return a;
}
function Cw(n, a) {
  return a(n);
}
function Tw(n) {
  const a = new AbortController();
  return new Promise((o, s) => {
    let c = !1;
    function d() {
      c || ((c = !0), h.unsubscribe());
    }
    a.signal.addEventListener("abort", () => {
      s(a.signal.reason);
    });
    const h = n.subscribe({
      next(m) {
        ((c = !0), o(m), d());
      },
      error(m) {
        s(m);
      },
      complete() {
        (a.abort(), d());
      },
    });
  });
}
var _w = Object.create,
  qg = Object.defineProperty,
  Aw = Object.getOwnPropertyDescriptor,
  Pg = Object.getOwnPropertyNames,
  Rw = Object.getPrototypeOf,
  Mw = Object.prototype.hasOwnProperty,
  Kr = (n, a) =>
    function () {
      return (
        a || (0, n[Pg(n)[0]])((a = { exports: {} }).exports, a),
        a.exports
      );
    },
  Nw = (n, a, i, o) => {
    if ((a && typeof a == "object") || typeof a == "function")
      for (var s = Pg(a), c = 0, d = s.length, h; c < d; c++)
        ((h = s[c]),
          !Mw.call(n, h) &&
            h !== i &&
            qg(n, h, {
              get: ((m) => a[m]).bind(null, h),
              enumerable: !(o = Aw(a, h)) || o.enumerable,
            }));
    return n;
  },
  Aa = (n, a, i) => (
    (i = n != null ? _w(Rw(n)) : {}),
    Nw(
      a || !n || !n.__esModule
        ? qg(i, "default", { value: n, enumerable: !0 })
        : i,
      n,
    )
  ),
  Dw = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutPropertiesLoose.js"(
      n,
      a,
    ) {
      function i(o, s) {
        if (o == null) return {};
        var c = {};
        for (var d in o)
          if ({}.hasOwnProperty.call(o, d)) {
            if (s.includes(d)) continue;
            c[d] = o[d];
          }
        return c;
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  jw = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectWithoutProperties.js"(
      n,
      a,
    ) {
      var i = Dw();
      function o(s, c) {
        if (s == null) return {};
        var d,
          h,
          m = i(s, c);
        if (Object.getOwnPropertySymbols) {
          var p = Object.getOwnPropertySymbols(s);
          for (h = 0; h < p.length; h++)
            ((d = p[h]),
              c.includes(d) ||
                ({}.propertyIsEnumerable.call(s, d) && (m[d] = s[d])));
        }
        return m;
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  kg = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/typeof.js"(
      n,
      a,
    ) {
      function i(o) {
        "@babel/helpers - typeof";
        return (
          (a.exports = i =
            typeof Symbol == "function" && typeof Symbol.iterator == "symbol"
              ? function (s) {
                  return typeof s;
                }
              : function (s) {
                  return s &&
                    typeof Symbol == "function" &&
                    s.constructor === Symbol &&
                    s !== Symbol.prototype
                    ? "symbol"
                    : typeof s;
                }),
          (a.exports.__esModule = !0),
          (a.exports.default = a.exports),
          i(o)
        );
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  zw = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPrimitive.js"(
      n,
      a,
    ) {
      var i = kg().default;
      function o(s, c) {
        if (i(s) != "object" || !s) return s;
        var d = s[Symbol.toPrimitive];
        if (d !== void 0) {
          var h = d.call(s, c || "default");
          if (i(h) != "object") return h;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (c === "string" ? String : Number)(s);
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Uw = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPropertyKey.js"(
      n,
      a,
    ) {
      var i = kg().default,
        o = zw();
      function s(c) {
        var d = o(c, "string");
        return i(d) == "symbol" ? d : d + "";
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Lw = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/defineProperty.js"(
      n,
      a,
    ) {
      var i = Uw();
      function o(s, c, d) {
        return (
          (c = i(c)) in s
            ? Object.defineProperty(s, c, {
                value: d,
                enumerable: !0,
                configurable: !0,
                writable: !0,
              })
            : (s[c] = d),
          s
        );
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Gl = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectSpread2.js"(
      n,
      a,
    ) {
      var i = Lw();
      function o(c, d) {
        var h = Object.keys(c);
        if (Object.getOwnPropertySymbols) {
          var m = Object.getOwnPropertySymbols(c);
          (d &&
            (m = m.filter(function (p) {
              return Object.getOwnPropertyDescriptor(c, p).enumerable;
            })),
            h.push.apply(h, m));
        }
        return h;
      }
      function s(c) {
        for (var d = 1; d < arguments.length; d++) {
          var h = arguments[d] != null ? arguments[d] : {};
          d % 2
            ? o(Object(h), !0).forEach(function (m) {
                i(c, m, h[m]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(c, Object.getOwnPropertyDescriptors(h))
              : o(Object(h)).forEach(function (m) {
                  Object.defineProperty(
                    c,
                    m,
                    Object.getOwnPropertyDescriptor(h, m),
                  );
                });
        }
        return c;
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Hw = Aa(jw(), 1),
  ty = Aa(Gl(), 1);
const Bw = ["cursor", "direction"];
function Mn(n, a, i) {
  const o = n.flatMap((s) => s.split("."));
  if (!a && (!i || i === "any")) return o.length ? [o] : [];
  if (i === "infinite" && wa(a) && ("direction" in a || "cursor" in a)) {
    const { cursor: s, direction: c } = a,
      d = (0, Hw.default)(a, Bw);
    return [o, { input: d, type: "infinite" }];
  }
  return [
    o,
    (0, ty.default)(
      (0, ty.default)({}, typeof a < "u" && a !== Ft && { input: a }),
      i && i !== "any" && { type: i },
    ),
  ];
}
function Cs(n) {
  return Mn(n, void 0, "any");
}
var qw = Object.create,
  Qg = Object.defineProperty,
  Pw = Object.getOwnPropertyDescriptor,
  Vg = Object.getOwnPropertyNames,
  kw = Object.getPrototypeOf,
  Qw = Object.prototype.hasOwnProperty,
  zn = (n, a) =>
    function () {
      return (
        a || (0, n[Vg(n)[0]])((a = { exports: {} }).exports, a),
        a.exports
      );
    },
  Vw = (n, a, i, o) => {
    if ((a && typeof a == "object") || typeof a == "function")
      for (var s = Vg(a), c = 0, d = s.length, h; c < d; c++)
        ((h = s[c]),
          !Qw.call(n, h) &&
            h !== i &&
            Qg(n, h, {
              get: ((m) => a[m]).bind(null, h),
              enumerable: !(o = Pw(a, h)) || o.enumerable,
            }));
    return n;
  },
  rt = (n, a, i) => (
    (i = n != null ? qw(kw(n)) : {}),
    Vw(
      a || !n || !n.__esModule
        ? Qg(i, "default", { value: n, enumerable: !0 })
        : i,
      n,
    )
  ),
  Yg = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/typeof.js"(
      n,
      a,
    ) {
      function i(o) {
        "@babel/helpers - typeof";
        return (
          (a.exports = i =
            typeof Symbol == "function" && typeof Symbol.iterator == "symbol"
              ? function (s) {
                  return typeof s;
                }
              : function (s) {
                  return s &&
                    typeof Symbol == "function" &&
                    s.constructor === Symbol &&
                    s !== Symbol.prototype
                    ? "symbol"
                    : typeof s;
                }),
          (a.exports.__esModule = !0),
          (a.exports.default = a.exports),
          i(o)
        );
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Yw = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPrimitive.js"(
      n,
      a,
    ) {
      var i = Yg().default;
      function o(s, c) {
        if (i(s) != "object" || !s) return s;
        var d = s[Symbol.toPrimitive];
        if (d !== void 0) {
          var h = d.call(s, c || "default");
          if (i(h) != "object") return h;
          throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return (c === "string" ? String : Number)(s);
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Gw = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/toPropertyKey.js"(
      n,
      a,
    ) {
      var i = Yg().default,
        o = Yw();
      function s(c) {
        var d = o(c, "string");
        return i(d) == "symbol" ? d : d + "";
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Ra = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/defineProperty.js"(
      n,
      a,
    ) {
      var i = Gw();
      function o(s, c, d) {
        return (
          (c = i(c)) in s
            ? Object.defineProperty(s, c, {
                value: d,
                enumerable: !0,
                configurable: !0,
                writable: !0,
              })
            : (s[c] = d),
          s
        );
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  bn = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/objectSpread2.js"(
      n,
      a,
    ) {
      var i = Ra();
      function o(c, d) {
        var h = Object.keys(c);
        if (Object.getOwnPropertySymbols) {
          var m = Object.getOwnPropertySymbols(c);
          (d &&
            (m = m.filter(function (p) {
              return Object.getOwnPropertyDescriptor(c, p).enumerable;
            })),
            h.push.apply(h, m));
        }
        return h;
      }
      function s(c) {
        for (var d = 1; d < arguments.length; d++) {
          var h = arguments[d] != null ? arguments[d] : {};
          d % 2
            ? o(Object(h), !0).forEach(function (m) {
                i(c, m, h[m]);
              })
            : Object.getOwnPropertyDescriptors
              ? Object.defineProperties(c, Object.getOwnPropertyDescriptors(h))
              : o(Object(h)).forEach(function (m) {
                  Object.defineProperty(
                    c,
                    m,
                    Object.getOwnPropertyDescriptor(h, m),
                  );
                });
        }
        return c;
      }
      ((a.exports = s),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  });
function Kw(n) {
  return (a) => {
    let i = 0,
      o = null;
    const s = [];
    function c() {
      o ||
        (o = a.subscribe({
          next(h) {
            for (const p of s) {
              var m;
              (m = p.next) === null || m === void 0 || m.call(p, h);
            }
          },
          error(h) {
            for (const p of s) {
              var m;
              (m = p.error) === null || m === void 0 || m.call(p, h);
            }
          },
          complete() {
            for (const m of s) {
              var h;
              (h = m.complete) === null || h === void 0 || h.call(m);
            }
          },
        }));
    }
    function d() {
      if (i === 0 && o) {
        const h = o;
        ((o = null), h.unsubscribe());
      }
    }
    return Ks(
      (h) => (
        i++,
        s.push(h),
        c(),
        {
          unsubscribe() {
            (i--, d());
            const m = s.findIndex((p) => p === h);
            m > -1 && s.splice(m, 1);
          },
        }
      ),
    );
  };
}
function Xw(n) {
  let a = n;
  const i = [],
    o = (d) => {
      (a !== void 0 && d.next(a), i.push(d));
    },
    s = (d) => {
      i.splice(i.indexOf(d), 1);
    },
    c = Ks(
      (d) => (
        o(d),
        () => {
          s(d);
        }
      ),
    );
  return (
    (c.next = (d) => {
      if (a !== d) {
        a = d;
        for (const h of i) h.next(d);
      }
    }),
    (c.get = () => a),
    c
  );
}
function Iw(n) {
  return Ks((a) => {
    function i(s = 0, c = n.op) {
      const d = n.links[s];
      if (!d)
        throw new Error(
          "No more links to execute - did you forget to add an ending link?",
        );
      return d({
        op: c,
        next(m) {
          return i(s + 1, m);
        },
      });
    }
    return i().subscribe(a);
  });
}
var hs = rt(Ra(), 1),
  gi = rt(bn(), 1);
function Zw(n) {
  return n instanceof Ll;
}
function Fw(n) {
  return (
    wa(n) &&
    wa(n.error) &&
    typeof n.error.code == "number" &&
    typeof n.error.message == "string"
  );
}
function $w(n, a) {
  return typeof n == "string"
    ? n
    : wa(n) && typeof n.message == "string"
      ? n.message
      : a;
}
var Ll = class Ts extends Error {
  constructor(a, i) {
    var o, s;
    const c = i?.cause;
    (super(a, { cause: c }),
      (0, hs.default)(this, "cause", void 0),
      (0, hs.default)(this, "shape", void 0),
      (0, hs.default)(this, "data", void 0),
      (0, hs.default)(this, "meta", void 0),
      (this.meta = i?.meta),
      (this.cause = c),
      (this.shape =
        i == null || (o = i.result) === null || o === void 0
          ? void 0
          : o.error),
      (this.data =
        i == null || (s = i.result) === null || s === void 0
          ? void 0
          : s.error.data),
      (this.name = "TRPCClientError"),
      Object.setPrototypeOf(this, Ts.prototype));
  }
  static from(a, i = {}) {
    const o = a;
    return Zw(o)
      ? (i.meta &&
          (o.meta = (0, gi.default)((0, gi.default)({}, o.meta), i.meta)),
        o)
      : Fw(o)
        ? new Ts(
            o.error.message,
            (0, gi.default)(
              (0, gi.default)({}, i),
              {},
              { result: o, cause: i.cause },
            ),
          )
        : new Ts(
            $w(o, "Unknown error"),
            (0, gi.default)((0, gi.default)({}, i), {}, { cause: o }),
          );
  }
};
function Jw(n) {
  const a = n;
  return a
    ? "input" in a
      ? a
      : { input: a, output: a }
    : {
        input: { serialize: (i) => i, deserialize: (i) => i },
        output: { serialize: (i) => i, deserialize: (i) => i },
      };
}
const ny = (n) => typeof n == "function";
function Ww(n) {
  if (n) return n;
  if (typeof window < "u" && ny(window.fetch)) return window.fetch;
  if (typeof globalThis < "u" && ny(globalThis.fetch)) return globalThis.fetch;
  throw new Error("No fetch implementation found");
}
var Nl = rt(bn());
function eE(n) {
  return {
    url: n.url.toString(),
    fetch: n.fetch,
    transformer: Jw(n.transformer),
    methodOverride: n.methodOverride,
  };
}
function tE(n) {
  const a = {};
  for (let i = 0; i < n.length; i++) {
    const o = n[i];
    a[i] = o;
  }
  return a;
}
const nE = { query: "GET", mutation: "POST", subscription: "PATCH" };
function Gg(n) {
  return "input" in n
    ? n.transformer.input.serialize(n.input)
    : tE(n.inputs.map((a) => n.transformer.input.serialize(a)));
}
const Kg = (n) => {
    const a = n.url.split("?");
    let o = a[0].replace(/\/$/, "") + "/" + n.path;
    const s = [];
    if (
      (a[1] && s.push(a[1]),
      "inputs" in n && s.push("batch=1"),
      n.type === "query" || n.type === "subscription")
    ) {
      const c = Gg(n);
      c !== void 0 &&
        n.methodOverride !== "POST" &&
        s.push(`input=${encodeURIComponent(JSON.stringify(c))}`);
    }
    return (s.length && (o += "?" + s.join("&")), o);
  },
  rE = (n) => {
    if (n.type === "query" && n.methodOverride !== "POST") return;
    const a = Gg(n);
    return a !== void 0 ? JSON.stringify(a) : void 0;
  },
  aE = (n) =>
    sE(
      (0, Nl.default)(
        (0, Nl.default)({}, n),
        {},
        { contentTypeHeader: "application/json", getUrl: Kg, getBody: rE },
      ),
    );
var iE = class extends Error {
  constructor() {
    const n = "AbortError";
    (super(n), (this.name = n), (this.message = n));
  }
};
const lE = (n) => {
  var a;
  if (n?.aborted)
    throw (
      (a = n.throwIfAborted) === null || a === void 0 || a.call(n),
      typeof DOMException < "u"
        ? new DOMException("AbortError", "AbortError")
        : new iE()
    );
};
async function oE(n) {
  var a, i;
  lE(n.signal);
  const o = n.getUrl(n),
    s = n.getBody(n),
    c = (a = n.methodOverride) !== null && a !== void 0 ? a : nE[n.type],
    d = await (async () => {
      const m = await n.headers();
      return Symbol.iterator in m ? Object.fromEntries(m) : m;
    })(),
    h = (0, Nl.default)(
      (0, Nl.default)(
        (0, Nl.default)(
          {},
          n.contentTypeHeader && c !== "GET"
            ? { "content-type": n.contentTypeHeader }
            : {},
        ),
        n.trpcAcceptHeader
          ? {
              [(i = n.trpcAcceptHeaderKey) !== null && i !== void 0
                ? i
                : "trpc-accept"]: n.trpcAcceptHeader,
            }
          : void 0,
      ),
      d,
    );
  return Ww(n.fetch)(o, { method: c, signal: n.signal, body: s, headers: h });
}
async function sE(n) {
  const a = {},
    i = await oE(n);
  a.response = i;
  const o = await i.json();
  return ((a.responseJSON = o), { json: o, meta: a });
}
rt(bn(), 1);
const ry = () => {
  throw new Error(
    "Something went wrong. Please submit an issue at https://github.com/trpc/trpc/issues/new",
  );
};
function ay(n) {
  let a = null,
    i = null;
  const o = () => {
    (clearTimeout(i), (i = null), (a = null));
  };
  function s(h) {
    const m = [[]];
    let p = 0;
    for (;;) {
      const w = h[p];
      if (!w) break;
      const E = m[m.length - 1];
      if (w.aborted) {
        var g;
        ((g = w.reject) === null ||
          g === void 0 ||
          g.call(w, new Error("Aborted")),
          p++);
        continue;
      }
      if (n.validate(E.concat(w).map((S) => S.key))) {
        (E.push(w), p++);
        continue;
      }
      if (E.length === 0) {
        var v;
        ((v = w.reject) === null ||
          v === void 0 ||
          v.call(w, new Error("Input is too big for a single dispatch")),
          p++);
        continue;
      }
      m.push([]);
    }
    return m;
  }
  function c() {
    const h = s(a);
    o();
    for (const m of h) {
      if (!m.length) continue;
      const p = { items: m };
      for (const v of m) v.batch = p;
      n.fetch(p.items.map((v) => v.key))
        .then(async (v) => {
          await Promise.all(
            v.map(async (E, C) => {
              const S = p.items[C];
              try {
                var R;
                const j = await Promise.resolve(E);
                (R = S.resolve) === null || R === void 0 || R.call(S, j);
              } catch (j) {
                var M;
                (M = S.reject) === null || M === void 0 || M.call(S, j);
              }
              ((S.batch = null), (S.reject = null), (S.resolve = null));
            }),
          );
          for (const E of p.items) {
            var w;
            ((w = E.reject) === null ||
              w === void 0 ||
              w.call(E, new Error("Missing result")),
              (E.batch = null));
          }
        })
        .catch((v) => {
          for (const E of p.items) {
            var w;
            ((w = E.reject) === null || w === void 0 || w.call(E, v),
              (E.batch = null));
          }
        });
    }
  }
  function d(h) {
    var m;
    const p = { aborted: !1, key: h, batch: null, resolve: ry, reject: ry },
      g = new Promise((v, w) => {
        var E;
        ((p.reject = w),
          (p.resolve = v),
          ((E = a) !== null && E !== void 0) || (a = []),
          a.push(p));
      });
    return (((m = i) !== null && m !== void 0) || (i = setTimeout(c)), g);
  }
  return { load: d };
}
function uE(...n) {
  const a = new AbortController(),
    i = n.length;
  let o = 0;
  const s = () => {
    ++o === i && a.abort();
  };
  for (const c of n)
    c?.aborted ? s() : c?.addEventListener("abort", s, { once: !0 });
  return a.signal;
}
var ms = rt(bn(), 1);
function cE(n) {
  var a, i;
  const o = eE(n),
    s = (a = n.maxURLLength) !== null && a !== void 0 ? a : 1 / 0,
    c = (i = n.maxItems) !== null && i !== void 0 ? i : 1 / 0;
  return () => {
    const d = (g) => ({
        validate(v) {
          if (s === 1 / 0 && c === 1 / 0) return !0;
          if (v.length > c) return !1;
          const w = v.map((S) => S.path).join(","),
            E = v.map((S) => S.input);
          return (
            Kg(
              (0, ms.default)(
                (0, ms.default)({}, o),
                {},
                { type: g, path: w, inputs: E, signal: null },
              ),
            ).length <= s
          );
        },
        async fetch(v) {
          const w = v.map((j) => j.path).join(","),
            E = v.map((j) => j.input),
            C = uE(...v.map((j) => j.signal)),
            S = await aE(
              (0, ms.default)(
                (0, ms.default)({}, o),
                {},
                {
                  path: w,
                  inputs: E,
                  type: g,
                  headers() {
                    return n.headers
                      ? typeof n.headers == "function"
                        ? n.headers({ opList: v })
                        : n.headers
                      : {};
                  },
                  signal: C,
                },
              ),
            );
          return (Array.isArray(S.json) ? S.json : v.map(() => S.json)).map(
            (j) => ({ meta: S.meta, json: j }),
          );
        },
      }),
      h = ay(d("query")),
      m = ay(d("mutation")),
      p = { query: h, mutation: m };
    return ({ op: g }) =>
      Ks((v) => {
        if (g.type === "subscription")
          throw new Error(
            "Subscriptions are unsupported by `httpLink` - use `httpSubscriptionLink` or `wsLink`",
          );
        const E = p[g.type].load(g);
        let C;
        return (
          E.then((S) => {
            C = S;
            const R = Ow(S.json, o.transformer.output);
            if (!R.ok) {
              v.error(Ll.from(R.error, { meta: S.meta }));
              return;
            }
            (v.next({ context: S.meta, result: R.result }), v.complete());
          }).catch((S) => {
            v.error(Ll.from(S, { meta: C?.meta }));
          }),
          () => {}
        );
      });
  };
}
rt(bn(), 1);
const Xg = (n, ...a) => (typeof n == "function" ? n(...a) : n);
rt(Ra(), 1);
function fE() {
  let n, a;
  return {
    promise: new Promise((o, s) => {
      ((n = o), (a = s));
    }),
    resolve: n,
    reject: a,
  };
}
async function dE(n) {
  const a = await Xg(n.url);
  if (!n.connectionParams) return a;
  const o = `${a.includes("?") ? "&" : "?"}connectionParams=1`;
  return a + o;
}
async function hE(n, a) {
  const i = { method: "connectionParams", data: await Xg(n) };
  return a.encode(i);
}
rt(Ra(), 1);
var Br = rt(Ra(), 1);
function mE(n) {
  const { promise: a, resolve: i, reject: o } = fE();
  return (
    n.addEventListener("open", () => {
      (n.removeEventListener("error", o), i());
    }),
    n.addEventListener("error", o),
    a
  );
}
function pE(n, { intervalMs: a, pongTimeoutMs: i }) {
  let o, s;
  function c() {
    o = setTimeout(() => {
      (n.send("PING"),
        (s = setTimeout(() => {
          n.close();
        }, i)));
    }, a);
  }
  function d() {
    (clearTimeout(o), c());
  }
  function h() {
    (clearTimeout(s), d());
  }
  (n.addEventListener("open", c),
    n.addEventListener("message", ({ data: m }) => {
      (clearTimeout(o), c(), m === "PONG" && h());
    }),
    n.addEventListener("close", () => {
      (clearTimeout(o), clearTimeout(s));
    }));
}
var vE = class ed {
  constructor(a) {
    var i;
    if (
      ((0, Br.default)(this, "id", ++ed.connectCount),
      (0, Br.default)(this, "WebSocketPonyfill", void 0),
      (0, Br.default)(this, "urlOptions", void 0),
      (0, Br.default)(this, "keepAliveOpts", void 0),
      (0, Br.default)(this, "encoder", void 0),
      (0, Br.default)(this, "wsObservable", Xw(null)),
      (0, Br.default)(this, "openPromise", null),
      (this.WebSocketPonyfill =
        (i = a.WebSocketPonyfill) !== null && i !== void 0 ? i : WebSocket),
      !this.WebSocketPonyfill)
    )
      throw new Error(
        "No WebSocket implementation found - you probably don't want to use this on the server, but if you do you need to pass a `WebSocket`-ponyfill",
      );
    ((this.urlOptions = a.urlOptions),
      (this.keepAliveOpts = a.keepAlive),
      (this.encoder = a.encoder));
  }
  get ws() {
    return this.wsObservable.get();
  }
  set ws(a) {
    this.wsObservable.next(a);
  }
  isOpen() {
    return (
      !!this.ws &&
      this.ws.readyState === this.WebSocketPonyfill.OPEN &&
      !this.openPromise
    );
  }
  isClosed() {
    return (
      !!this.ws &&
      (this.ws.readyState === this.WebSocketPonyfill.CLOSING ||
        this.ws.readyState === this.WebSocketPonyfill.CLOSED)
    );
  }
  async open() {
    var a = this;
    if (a.openPromise) return a.openPromise;
    a.id = ++ed.connectCount;
    const i = dE(a.urlOptions).then((o) => new a.WebSocketPonyfill(o));
    a.openPromise = i.then(async (o) => {
      ((a.ws = o),
        (o.binaryType = "arraybuffer"),
        o.addEventListener("message", function ({ data: s }) {
          s === "PING" && this.send("PONG");
        }),
        a.keepAliveOpts.enabled && pE(o, a.keepAliveOpts),
        o.addEventListener("close", () => {
          a.ws === o && (a.ws = null);
        }),
        await mE(o),
        a.urlOptions.connectionParams &&
          o.send(await hE(a.urlOptions.connectionParams, a.encoder)));
    });
    try {
      await a.openPromise;
    } finally {
      a.openPromise = null;
    }
  }
  async close() {
    var a = this;
    try {
      await a.openPromise;
    } finally {
      var i;
      (i = a.ws) === null || i === void 0 || i.close();
    }
  }
};
(0, Br.default)(vE, "connectCount", 0);
rt(Ra(), 1);
rt(bn(), 1);
var Of = rt(Ra(), 1),
  iy = rt(bn(), 1),
  Xs = class {
    constructor(n) {
      ((0, Of.default)(this, "links", void 0),
        (0, Of.default)(this, "runtime", void 0),
        (0, Of.default)(this, "requestId", void 0),
        (this.requestId = 0),
        (this.runtime = {}),
        (this.links = n.links.map((a) => a(this.runtime))));
    }
    $request(n) {
      var a;
      return Iw({
        links: this.links,
        op: (0, iy.default)(
          (0, iy.default)({}, n),
          {},
          {
            context: (a = n.context) !== null && a !== void 0 ? a : {},
            id: ++this.requestId,
          },
        ),
      }).pipe(Kw());
    }
    async requestAsPromise(n) {
      var a = this;
      try {
        const i = a.$request(n);
        return (await Tw(i)).result.data;
      } catch (i) {
        throw Ll.from(i);
      }
    }
    query(n, a, i) {
      return this.requestAsPromise({
        type: "query",
        path: n,
        input: a,
        context: i?.context,
        signal: i?.signal,
      });
    }
    mutation(n, a, i) {
      return this.requestAsPromise({
        type: "mutation",
        path: n,
        input: a,
        context: i?.context,
        signal: i?.signal,
      });
    }
    subscription(n, a, i) {
      return this.$request({
        type: "subscription",
        path: n,
        input: a,
        context: i.context,
        signal: i.signal,
      }).subscribe({
        next(s) {
          switch (s.result.type) {
            case "state": {
              var c;
              (c = i.onConnectionStateChange) === null ||
                c === void 0 ||
                c.call(i, s.result);
              break;
            }
            case "started": {
              var d;
              (d = i.onStarted) === null ||
                d === void 0 ||
                d.call(i, { context: s.context });
              break;
            }
            case "stopped": {
              var h;
              (h = i.onStopped) === null || h === void 0 || h.call(i);
              break;
            }
            case "data":
            case void 0: {
              var m;
              (m = i.onData) === null ||
                m === void 0 ||
                m.call(i, s.result.data);
              break;
            }
          }
        },
        error(s) {
          var c;
          (c = i.onError) === null || c === void 0 || c.call(i, s);
        },
        complete() {
          var s;
          (s = i.onComplete) === null || s === void 0 || s.call(i);
        },
      });
    }
  };
const Ig = Symbol.for("trpc_untypedClient"),
  yE = { query: "query", mutate: "mutation", subscribe: "subscription" },
  gE = (n) => yE[n];
function Zg(n) {
  const a = Gs(({ path: i, args: o }) => {
    const s = [...i],
      c = gE(s.pop()),
      d = s.join(".");
    return n[c](d, ...o);
  });
  return Rd((i) => (i === Ig ? n : a[i]));
}
function bE(n) {
  const a = new Xs(n);
  return Zg(a);
}
function Nd(n) {
  return n[Ig];
}
rt(bn(), 1);
rt(bn(), 1);
var xE = zn({
  "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncIterator.js"(
    n,
    a,
  ) {
    function i(s) {
      var c,
        d,
        h,
        m = 2;
      for (
        typeof Symbol < "u" &&
        ((d = Symbol.asyncIterator), (h = Symbol.iterator));
        m--;
      ) {
        if (d && (c = s[d]) != null) return c.call(s);
        if (h && (c = s[h]) != null) return new o(c.call(s));
        ((d = "@@asyncIterator"), (h = "@@iterator"));
      }
      throw new TypeError("Object is not async iterable");
    }
    function o(s) {
      function c(d) {
        if (Object(d) !== d)
          return Promise.reject(new TypeError(d + " is not an object."));
        var h = d.done;
        return Promise.resolve(d.value).then(function (m) {
          return { value: m, done: h };
        });
      }
      return (
        (o = function (h) {
          ((this.s = h), (this.n = h.next));
        }),
        (o.prototype = {
          s: null,
          n: null,
          next: function () {
            return c(this.n.apply(this.s, arguments));
          },
          return: function (h) {
            var m = this.s.return;
            return m === void 0
              ? Promise.resolve({ value: h, done: !0 })
              : c(m.apply(this.s, arguments));
          },
          throw: function (h) {
            var m = this.s.return;
            return m === void 0
              ? Promise.reject(h)
              : c(m.apply(this.s, arguments));
          },
        }),
        new o(s)
      );
    }
    ((a.exports = i),
      (a.exports.__esModule = !0),
      (a.exports.default = a.exports));
  },
});
rt(xE(), 1);
rt(bn(), 1);
var SE = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/usingCtx.js"(
      n,
      a,
    ) {
      function i() {
        var o =
            typeof SuppressedError == "function"
              ? SuppressedError
              : function (h, m) {
                  var p = Error();
                  return (
                    (p.name = "SuppressedError"),
                    (p.error = h),
                    (p.suppressed = m),
                    p
                  );
                },
          s = {},
          c = [];
        function d(h, m) {
          if (m != null) {
            if (Object(m) !== m)
              throw new TypeError(
                "using declarations can only be used with objects, functions, null, or undefined.",
              );
            if (h)
              var p =
                m[Symbol.asyncDispose || Symbol.for("Symbol.asyncDispose")];
            if (
              p === void 0 &&
              ((p = m[Symbol.dispose || Symbol.for("Symbol.dispose")]), h)
            )
              var g = p;
            if (typeof p != "function")
              throw new TypeError("Object is not disposable.");
            (g &&
              (p = function () {
                try {
                  g.call(m);
                } catch (w) {
                  return Promise.reject(w);
                }
              }),
              c.push({ v: m, d: p, a: h }));
          } else h && c.push({ d: m, a: h });
          return m;
        }
        return {
          e: s,
          u: d.bind(null, !1),
          a: d.bind(null, !0),
          d: function () {
            var m,
              p = this.e,
              g = 0;
            function v() {
              for (; (m = c.pop()); )
                try {
                  if (!m.a && g === 1)
                    return ((g = 0), c.push(m), Promise.resolve().then(v));
                  if (m.d) {
                    var E = m.d.call(m.v);
                    if (m.a) return ((g |= 2), Promise.resolve(E).then(v, w));
                  } else g |= 1;
                } catch (C) {
                  return w(C);
                }
              if (g === 1)
                return p !== s ? Promise.reject(p) : Promise.resolve();
              if (p !== s) throw p;
            }
            function w(E) {
              return ((p = p !== s ? new o(E, p) : E), v());
            }
            return v();
          },
        };
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  Fg = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/OverloadYield.js"(
      n,
      a,
    ) {
      function i(o, s) {
        ((this.v = o), (this.k = s));
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  wE = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/awaitAsyncGenerator.js"(
      n,
      a,
    ) {
      var i = Fg();
      function o(s) {
        return new i(s, 0);
      }
      ((a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  EE = zn({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/wrapAsyncGenerator.js"(
      n,
      a,
    ) {
      var i = Fg();
      function o(c) {
        return function () {
          return new s(c.apply(this, arguments));
        };
      }
      function s(c) {
        var d, h;
        function m(g, v) {
          try {
            var w = c[g](v),
              E = w.value,
              C = E instanceof i;
            Promise.resolve(C ? E.v : E).then(
              function (S) {
                if (C) {
                  var R = g === "return" ? "return" : "next";
                  if (!E.k || S.done) return m(R, S);
                  S = c[R](S).value;
                }
                p(w.done ? "return" : "normal", S);
              },
              function (S) {
                m("throw", S);
              },
            );
          } catch (S) {
            p("throw", S);
          }
        }
        function p(g, v) {
          switch (g) {
            case "return":
              d.resolve({ value: v, done: !0 });
              break;
            case "throw":
              d.reject(v);
              break;
            default:
              d.resolve({ value: v, done: !1 });
          }
          (d = d.next) ? m(d.key, d.arg) : (h = null);
        }
        ((this._invoke = function (g, v) {
          return new Promise(function (w, E) {
            var C = { key: g, arg: v, resolve: w, reject: E, next: null };
            h ? (h = h.next = C) : ((d = h = C), m(g, v));
          });
        }),
          typeof c.return != "function" && (this.return = void 0));
      }
      ((s.prototype[
        (typeof Symbol == "function" && Symbol.asyncIterator) ||
          "@@asyncIterator"
      ] = function () {
        return this;
      }),
        (s.prototype.next = function (c) {
          return this._invoke("next", c);
        }),
        (s.prototype.throw = function (c) {
          return this._invoke("throw", c);
        }),
        (s.prototype.return = function (c) {
          return this._invoke("return", c);
        }),
        (a.exports = o),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  });
rt(SE(), 1);
rt(wE(), 1);
rt(EE(), 1);
rt(bn(), 1);
function OE(n) {
  return Gs(({ path: a, args: i }) => {
    var o;
    const s = [...a],
      c = s.pop();
    if (c === "useMutation") return n[c](s, ...i);
    if (c === "_def") return { path: s };
    const [d, ...h] = i,
      m = (o = h[0]) !== null && o !== void 0 ? o : {};
    return n[c](s, d, m);
  });
}
var Cf;
const CE = ["client", "ssrContext", "ssrState", "abortOnUnmount"],
  TE =
    (Cf = b.createContext) === null || Cf === void 0
      ? void 0
      : Cf.call(Ql, null),
  _E = (n) => {
    switch (n) {
      case "queryOptions":
      case "fetch":
      case "ensureData":
      case "prefetch":
      case "getData":
      case "setData":
      case "setQueriesData":
        return "query";
      case "infiniteQueryOptions":
      case "fetchInfinite":
      case "prefetchInfinite":
      case "getInfiniteData":
      case "setInfiniteData":
        return "infinite";
      case "setMutationDefaults":
      case "getMutationDefaults":
      case "isMutating":
      case "cancel":
      case "invalidate":
      case "refetch":
      case "reset":
        return "any";
    }
  };
function AE(n) {
  return Gs((a) => {
    const i = [...a.path],
      o = i.pop(),
      s = [...a.args],
      c = s.shift(),
      d = _E(o),
      h = Mn(i, c, d);
    return {
      infiniteQueryOptions: () => n.infiniteQueryOptions(i, h, s[0]),
      queryOptions: () => n.queryOptions(i, h, ...s),
      fetch: () => n.fetchQuery(h, ...s),
      fetchInfinite: () => n.fetchInfiniteQuery(h, s[0]),
      prefetch: () => n.prefetchQuery(h, ...s),
      prefetchInfinite: () => n.prefetchInfiniteQuery(h, s[0]),
      ensureData: () => n.ensureQueryData(h, ...s),
      invalidate: () => n.invalidateQueries(h, ...s),
      reset: () => n.resetQueries(h, ...s),
      refetch: () => n.refetchQueries(h, ...s),
      cancel: () => n.cancelQuery(h, ...s),
      setData: () => {
        n.setQueryData(h, s[0], s[1]);
      },
      setQueriesData: () => n.setQueriesData(h, s[0], s[1], s[2]),
      setInfiniteData: () => {
        n.setInfiniteQueryData(h, s[0], s[1]);
      },
      getData: () => n.getQueryData(h),
      getInfiniteData: () => n.getInfiniteQueryData(h),
      setMutationDefaults: () => n.setMutationDefaults(Cs(i), c),
      getMutationDefaults: () => n.getMutationDefaults(Cs(i)),
      isMutating: () => n.isMutating({ mutationKey: Cs(i) }),
    }[o]();
  });
}
function RE(n) {
  const a = Zg(n.client),
    i = AE(n);
  return Rd((o) => {
    const s = o;
    return s === "client" ? a : CE.includes(s) ? n[s] : i[o];
  });
}
var ME = Aa(Gl(), 1);
function ly(n) {
  const a = n instanceof Xs ? n : Nd(n);
  return Gs((i) => {
    const o = i.path,
      s = o.join("."),
      [c, d] = i.args;
    return (0, ME.default)(
      { queryKey: Mn(o, c, "query"), queryFn: () => a.query(s, c, d?.trpc) },
      d,
    );
  });
}
var Tf = Aa(Gl(), 1);
function Rt(n, a, i) {
  var o;
  const s = n[0];
  let c = (o = n[1]) === null || o === void 0 ? void 0 : o.input;
  if (i) {
    var d;
    c = (0, Tf.default)(
      (0, Tf.default)(
        (0, Tf.default)({}, (d = c) !== null && d !== void 0 ? d : {}),
        i.pageParam ? { cursor: i.pageParam } : {},
      ),
      {},
      { direction: i.direction },
    );
  }
  return [s.join("."), c, a?.trpc];
}
var NE = Kr({
    "../../node_modules/.pnpm/@oxc-project+runtime@0.72.2/node_modules/@oxc-project/runtime/src/helpers/asyncIterator.js"(
      n,
      a,
    ) {
      function i(s) {
        var c,
          d,
          h,
          m = 2;
        for (
          typeof Symbol < "u" &&
          ((d = Symbol.asyncIterator), (h = Symbol.iterator));
          m--;
        ) {
          if (d && (c = s[d]) != null) return c.call(s);
          if (h && (c = s[h]) != null) return new o(c.call(s));
          ((d = "@@asyncIterator"), (h = "@@iterator"));
        }
        throw new TypeError("Object is not async iterable");
      }
      function o(s) {
        function c(d) {
          if (Object(d) !== d)
            return Promise.reject(new TypeError(d + " is not an object."));
          var h = d.done;
          return Promise.resolve(d.value).then(function (m) {
            return { value: m, done: h };
          });
        }
        return (
          (o = function (h) {
            ((this.s = h), (this.n = h.next));
          }),
          (o.prototype = {
            s: null,
            n: null,
            next: function () {
              return c(this.n.apply(this.s, arguments));
            },
            return: function (h) {
              var m = this.s.return;
              return m === void 0
                ? Promise.resolve({ value: h, done: !0 })
                : c(m.apply(this.s, arguments));
            },
            throw: function (h) {
              var m = this.s.return;
              return m === void 0
                ? Promise.reject(h)
                : c(m.apply(this.s, arguments));
            },
          }),
          new o(s)
        );
      }
      ((a.exports = i),
        (a.exports.__esModule = !0),
        (a.exports.default = a.exports));
    },
  }),
  DE = Aa(NE(), 1);
function td(n) {
  return { path: n.path.join(".") };
}
function Tl(n) {
  const a = td(n);
  return b.useMemo(() => a, [a]);
}
async function $g(n, a, i) {
  const s = a.getQueryCache().build(a, { queryKey: i });
  s.setState({ data: [], status: "success" });
  const c = [];
  var d = !1,
    h = !1,
    m;
  try {
    for (
      var p = (0, DE.default)(n), g;
      (d = !(g = await p.next()).done);
      d = !1
    ) {
      const v = g.value;
      (c.push(v), s.setState({ data: [...c] }));
    }
  } catch (v) {
    ((h = !0), (m = v));
  } finally {
    try {
      d && p.return != null && (await p.return());
    } finally {
      if (h) throw m;
    }
  }
  return c;
}
var Ue = Aa(Gl(), 1);
function jE(n) {
  const { client: a, queryClient: i } = n,
    o = a instanceof Xs ? a : Nd(a);
  return {
    infiniteQueryOptions: (s, c, d) => {
      var h, m;
      const p = ((h = c[1]) === null || h === void 0 ? void 0 : h.input) === Ft,
        g = async (v) => {
          var w;
          const E = (0, Ue.default)(
            (0, Ue.default)({}, d),
            {},
            {
              trpc: (0, Ue.default)(
                (0, Ue.default)({}, d?.trpc),
                !(d == null || (w = d.trpc) === null || w === void 0) &&
                  w.abortOnUnmount
                  ? { signal: v.signal }
                  : { signal: null },
              ),
            },
          );
          return await o.query(
            ...Rt(c, E, { direction: v.direction, pageParam: v.pageParam }),
          );
        };
      return Object.assign(
        (0, Ue.default)(
          (0, Ue.default)({}, d),
          {},
          {
            initialData: d?.initialData,
            queryKey: c,
            queryFn: p ? Ft : g,
            initialPageParam:
              (m = d?.initialCursor) !== null && m !== void 0 ? m : null,
          },
        ),
        { trpc: td({ path: s }) },
      );
    },
    queryOptions: (s, c, d) => {
      var h;
      const m = ((h = c[1]) === null || h === void 0 ? void 0 : h.input) === Ft,
        p = async (g) => {
          var v;
          const w = (0, Ue.default)(
              (0, Ue.default)({}, d),
              {},
              {
                trpc: (0, Ue.default)(
                  (0, Ue.default)({}, d?.trpc),
                  !(d == null || (v = d.trpc) === null || v === void 0) &&
                    v.abortOnUnmount
                    ? { signal: g.signal }
                    : { signal: null },
                ),
              },
            ),
            E = await o.query(...Rt(c, w));
          return Dg(E) ? $g(E, i, c) : E;
        };
      return Object.assign(
        (0, Ue.default)(
          (0, Ue.default)({}, d),
          {},
          { initialData: d?.initialData, queryKey: c, queryFn: m ? Ft : p },
        ),
        { trpc: td({ path: s }) },
      );
    },
    fetchQuery: (s, c) =>
      i.fetchQuery(
        (0, Ue.default)(
          (0, Ue.default)({}, c),
          {},
          { queryKey: s, queryFn: () => o.query(...Rt(s, c)) },
        ),
      ),
    fetchInfiniteQuery: (s, c) => {
      var d;
      return i.fetchInfiniteQuery(
        (0, Ue.default)(
          (0, Ue.default)({}, c),
          {},
          {
            queryKey: s,
            queryFn: ({ pageParam: h, direction: m }) =>
              o.query(...Rt(s, c, { pageParam: h, direction: m })),
            initialPageParam:
              (d = c?.initialCursor) !== null && d !== void 0 ? d : null,
          },
        ),
      );
    },
    prefetchQuery: (s, c) =>
      i.prefetchQuery(
        (0, Ue.default)(
          (0, Ue.default)({}, c),
          {},
          { queryKey: s, queryFn: () => o.query(...Rt(s, c)) },
        ),
      ),
    prefetchInfiniteQuery: (s, c) => {
      var d;
      return i.prefetchInfiniteQuery(
        (0, Ue.default)(
          (0, Ue.default)({}, c),
          {},
          {
            queryKey: s,
            queryFn: ({ pageParam: h, direction: m }) =>
              o.query(...Rt(s, c, { pageParam: h, direction: m })),
            initialPageParam:
              (d = c?.initialCursor) !== null && d !== void 0 ? d : null,
          },
        ),
      );
    },
    ensureQueryData: (s, c) =>
      i.ensureQueryData(
        (0, Ue.default)(
          (0, Ue.default)({}, c),
          {},
          { queryKey: s, queryFn: () => o.query(...Rt(s, c)) },
        ),
      ),
    invalidateQueries: (s, c, d) =>
      i.invalidateQueries(
        (0, Ue.default)((0, Ue.default)({}, c), {}, { queryKey: s }),
        d,
      ),
    resetQueries: (s, c, d) =>
      i.resetQueries(
        (0, Ue.default)((0, Ue.default)({}, c), {}, { queryKey: s }),
        d,
      ),
    refetchQueries: (s, c, d) =>
      i.refetchQueries(
        (0, Ue.default)((0, Ue.default)({}, c), {}, { queryKey: s }),
        d,
      ),
    cancelQuery: (s, c) => i.cancelQueries({ queryKey: s }, c),
    setQueryData: (s, c, d) => i.setQueryData(s, c, d),
    setQueriesData: (s, c, d, h) =>
      i.setQueriesData(
        (0, Ue.default)((0, Ue.default)({}, c), {}, { queryKey: s }),
        d,
        h,
      ),
    getQueryData: (s) => i.getQueryData(s),
    setInfiniteQueryData: (s, c, d) => i.setQueryData(s, c, d),
    getInfiniteQueryData: (s) => i.getQueryData(s),
    setMutationDefaults: (s, c) => {
      const d = s[0],
        h = (m) => o.mutation(...Rt([d, { input: m }], n));
      return i.setMutationDefaults(
        s,
        typeof c == "function" ? c({ canonicalMutationFn: h }) : c,
      );
    },
    getMutationDefaults: (s) => i.getMutationDefaults(s),
    isMutating: (s) =>
      i.isMutating((0, Ue.default)((0, Ue.default)({}, s), {}, { exact: !0 })),
  };
}
var fe = Aa(Gl());
const oy = (n, a) =>
  new Proxy(n, {
    get(o, s) {
      return (a(s), o[s]);
    },
  });
function zE(n) {
  var a, i;
  const o = (a = void 0) !== null && a !== void 0 ? a : (Q) => Q.originalFn(),
    s = (i = void 0) !== null && i !== void 0 ? i : TE,
    c = bE,
    d = (Q) => {
      var V;
      const { abortOnUnmount: N = !1, queryClient: U, ssrContext: W } = Q,
        [ne, ae] = b.useState(
          (V = Q.ssrState) !== null && V !== void 0 ? V : !1,
        ),
        te = Q.client instanceof Xs ? Q.client : Nd(Q.client),
        oe = b.useMemo(() => jE({ client: te, queryClient: U }), [te, U]),
        se = b.useMemo(
          () =>
            (0, fe.default)(
              {
                abortOnUnmount: N,
                queryClient: U,
                client: te,
                ssrContext: W ?? null,
                ssrState: ne,
              },
              oe,
            ),
          [N, te, oe, U, W, ne],
        );
      return (
        b.useEffect(() => {
          ae((ce) => (ce ? "mounted" : !1));
        }, []),
        O.jsx(s.Provider, { value: se, children: Q.children })
      );
    };
  function h() {
    const Q = b.useContext(s);
    if (!Q)
      throw new Error(
        "Unable to find tRPC Context. Did you forget to wrap your App inside `withTRPC` HoC?",
      );
    return Q;
  }
  function m(Q, V) {
    var N;
    const { queryClient: U, ssrState: W } = h();
    return W &&
      W !== "mounted" &&
      ((N = U.getQueryCache().find({ queryKey: Q })) === null || N === void 0
        ? void 0
        : N.state.status) === "error"
      ? (0, fe.default)({ retryOnMount: !1 }, V)
      : V;
  }
  function p(Q, V, N) {
    var U, W, ne, ae, te;
    const oe = h(),
      {
        abortOnUnmount: se,
        client: ce,
        ssrState: A,
        queryClient: B,
        prefetchQuery: K,
      } = oe,
      le = Mn(Q, V, "query"),
      J = B.getQueryDefaults(le),
      T = V === Ft;
    typeof window > "u" &&
      A === "prepass" &&
      (N == null || (U = N.trpc) === null || U === void 0 ? void 0 : U.ssr) !==
        !1 &&
      ((W = N?.enabled) !== null && W !== void 0 ? W : J?.enabled) !== !1 &&
      !T &&
      !B.getQueryCache().find({ queryKey: le }) &&
      K(le, N);
    const G = m(le, (0, fe.default)((0, fe.default)({}, J), N)),
      k =
        (ne =
          (ae =
            N == null || (te = N.trpc) === null || te === void 0
              ? void 0
              : te.abortOnUnmount) !== null && ae !== void 0
            ? ae
            : void 0) !== null && ne !== void 0
          ? ne
          : se,
      I = lw(
        (0, fe.default)(
          (0, fe.default)({}, G),
          {},
          {
            queryKey: le,
            queryFn: T
              ? V
              : async (ee) => {
                  const ue = (0, fe.default)(
                      (0, fe.default)({}, G),
                      {},
                      {
                        trpc: (0, fe.default)(
                          (0, fe.default)({}, G?.trpc),
                          k ? { signal: ee.signal } : { signal: null },
                        ),
                      },
                    ),
                    re = await ce.query(...Rt(le, ue));
                  return Dg(re) ? $g(re, B, le) : re;
                },
          },
        ),
        B,
      );
    return ((I.trpc = Tl({ path: Q })), I);
  }
  function g(Q, V, N) {
    var U, W, ne;
    const ae = h(),
      te = Mn(Q, V, "query"),
      oe = V === Ft,
      se =
        (U =
          (W =
            N == null || (ne = N.trpc) === null || ne === void 0
              ? void 0
              : ne.abortOnUnmount) !== null && W !== void 0
            ? W
            : void 0) !== null && U !== void 0
          ? U
          : ae.abortOnUnmount;
    cw(
      (0, fe.default)(
        (0, fe.default)({}, N),
        {},
        {
          queryKey: te,
          queryFn: oe
            ? V
            : (ce) => {
                const A = {
                  trpc: (0, fe.default)(
                    (0, fe.default)({}, N?.trpc),
                    se ? { signal: ce.signal } : {},
                  ),
                };
                return ae.client.query(...Rt(te, A));
              },
        },
      ),
    );
  }
  function v(Q, V, N) {
    var U, W, ne;
    const ae = h(),
      te = Mn(Q, V, "query"),
      oe =
        (U =
          (W =
            N == null || (ne = N.trpc) === null || ne === void 0
              ? void 0
              : ne.abortOnUnmount) !== null && W !== void 0
            ? W
            : void 0) !== null && U !== void 0
          ? U
          : ae.abortOnUnmount,
      se = ow(
        (0, fe.default)(
          (0, fe.default)({}, N),
          {},
          {
            queryKey: te,
            queryFn: (ce) => {
              const A = (0, fe.default)(
                (0, fe.default)({}, N),
                {},
                {
                  trpc: (0, fe.default)(
                    (0, fe.default)({}, N?.trpc),
                    oe ? { signal: ce.signal } : { signal: null },
                  ),
                },
              );
              return ae.client.query(...Rt(te, A));
            },
          },
        ),
        ae.queryClient,
      );
    return ((se.trpc = Tl({ path: Q })), [se.data, se]);
  }
  function w(Q, V) {
    const { client: N, queryClient: U } = h(),
      W = Cs(Q),
      ne = U.defaultMutationOptions(U.getMutationDefaults(W)),
      ae = dw(
        (0, fe.default)(
          (0, fe.default)({}, V),
          {},
          {
            mutationKey: W,
            mutationFn: (te) => N.mutation(...Rt([Q, { input: te }], V)),
            onSuccess(...te) {
              var oe, se;
              return o({
                originalFn: () => {
                  var A, B, K;
                  return (A =
                    V == null || (B = V.onSuccess) === null || B === void 0
                      ? void 0
                      : B.call(V, ...te)) !== null && A !== void 0
                    ? A
                    : ne == null || (K = ne.onSuccess) === null || K === void 0
                      ? void 0
                      : K.call(ne, ...te);
                },
                queryClient: U,
                meta:
                  (oe =
                    (se = V?.meta) !== null && se !== void 0
                      ? se
                      : ne?.meta) !== null && oe !== void 0
                    ? oe
                    : {},
              });
            },
          },
        ),
        U,
      );
    return ((ae.trpc = Tl({ path: Q })), ae);
  }
  const E = { data: void 0, error: null, status: "idle" },
    C = { data: void 0, error: null, status: "connecting" };
  function S(Q, V, N) {
    var U;
    const W = (U = N?.enabled) !== null && U !== void 0 ? U : V !== Ft,
      ne = Qr(Mn(Q, V, "any")),
      { client: ae } = h(),
      te = b.useRef(N);
    b.useEffect(() => {
      te.current = N;
    });
    const [oe] = b.useState(new Set([])),
      se = b.useCallback(
        (T) => {
          oe.add(T);
        },
        [oe],
      ),
      ce = b.useRef(null),
      A = b.useCallback(
        (T) => {
          const G = K.current,
            k = (K.current = T(G));
          let I = !1;
          for (const ee of oe)
            if (G[ee] !== k[ee]) {
              I = !0;
              break;
            }
          I && J(oy(k, se));
        },
        [se, oe],
      ),
      B = b.useCallback(() => {
        var T;
        if (
          ((T = ce.current) === null || T === void 0 || T.unsubscribe(), !W)
        ) {
          A(() => (0, fe.default)((0, fe.default)({}, E), {}, { reset: B }));
          return;
        }
        A(() => (0, fe.default)((0, fe.default)({}, C), {}, { reset: B }));
        const G = ae.subscription(Q.join("."), V ?? void 0, {
          onStarted: () => {
            var k, I;
            ((k = (I = te.current).onStarted) === null ||
              k === void 0 ||
              k.call(I),
              A((ee) =>
                (0, fe.default)(
                  (0, fe.default)({}, ee),
                  {},
                  { status: "pending", error: null },
                ),
              ));
          },
          onData: (k) => {
            var I, ee;
            ((I = (ee = te.current).onData) === null ||
              I === void 0 ||
              I.call(ee, k),
              A((ue) =>
                (0, fe.default)(
                  (0, fe.default)({}, ue),
                  {},
                  { status: "pending", data: k, error: null },
                ),
              ));
          },
          onError: (k) => {
            var I, ee;
            ((I = (ee = te.current).onError) === null ||
              I === void 0 ||
              I.call(ee, k),
              A((ue) =>
                (0, fe.default)(
                  (0, fe.default)({}, ue),
                  {},
                  { status: "error", error: k },
                ),
              ));
          },
          onConnectionStateChange: (k) => {
            A((I) => {
              switch (k.state) {
                case "idle":
                  return (0, fe.default)(
                    (0, fe.default)({}, I),
                    {},
                    { status: k.state, error: null, data: void 0 },
                  );
                case "connecting":
                  return (0, fe.default)(
                    (0, fe.default)({}, I),
                    {},
                    { error: k.error, status: k.state },
                  );
                case "pending":
                  return I;
              }
            });
          },
          onComplete: () => {
            var k, I;
            ((k = (I = te.current).onComplete) === null ||
              k === void 0 ||
              k.call(I),
              A((ee) =>
                (0, fe.default)(
                  (0, fe.default)({}, ee),
                  {},
                  { status: "idle", error: null, data: void 0 },
                ),
              ));
          },
        });
        ce.current = G;
      }, [ae, ne, W, A]);
    b.useEffect(
      () => (
        B(),
        () => {
          var T;
          (T = ce.current) === null || T === void 0 || T.unsubscribe();
        }
      ),
      [B],
    );
    const K = b.useRef(
        W
          ? (0, fe.default)((0, fe.default)({}, C), {}, { reset: B })
          : (0, fe.default)((0, fe.default)({}, E), {}, { reset: B }),
      ),
      [le, J] = b.useState(oy(K.current, se));
    return le;
  }
  function R(Q, V, N) {
    var U, W, ne, ae, te;
    const {
        client: oe,
        ssrState: se,
        prefetchInfiniteQuery: ce,
        queryClient: A,
        abortOnUnmount: B,
      } = h(),
      K = Mn(Q, V, "infinite"),
      le = A.getQueryDefaults(K),
      J = V === Ft;
    typeof window > "u" &&
      se === "prepass" &&
      (N == null || (U = N.trpc) === null || U === void 0 ? void 0 : U.ssr) !==
        !1 &&
      ((W = N?.enabled) !== null && W !== void 0 ? W : le?.enabled) !== !1 &&
      !J &&
      !A.getQueryCache().find({ queryKey: K }) &&
      ce(K, (0, fe.default)((0, fe.default)({}, le), N));
    const T = m(K, (0, fe.default)((0, fe.default)({}, le), N)),
      G =
        (ne =
          N == null || (ae = N.trpc) === null || ae === void 0
            ? void 0
            : ae.abortOnUnmount) !== null && ne !== void 0
          ? ne
          : B,
      k = hw(
        (0, fe.default)(
          (0, fe.default)({}, T),
          {},
          {
            initialPageParam:
              (te = N.initialCursor) !== null && te !== void 0 ? te : null,
            persister: N.persister,
            queryKey: K,
            queryFn: J
              ? V
              : (I) => {
                  var ee;
                  const ue = (0, fe.default)(
                    (0, fe.default)({}, T),
                    {},
                    {
                      trpc: (0, fe.default)(
                        (0, fe.default)({}, T?.trpc),
                        G ? { signal: I.signal } : { signal: null },
                      ),
                    },
                  );
                  return oe.query(
                    ...Rt(K, ue, {
                      pageParam:
                        (ee = I.pageParam) !== null && ee !== void 0
                          ? ee
                          : N.initialCursor,
                      direction: I.direction,
                    }),
                  );
                },
          },
        ),
        A,
      );
    return ((k.trpc = Tl({ path: Q })), k);
  }
  function M(Q, V, N) {
    var U, W, ne;
    const ae = h(),
      te = Mn(Q, V, "infinite"),
      oe = ae.queryClient.getQueryDefaults(te),
      se = V === Ft,
      ce = m(te, (0, fe.default)((0, fe.default)({}, oe), N)),
      A =
        (U =
          N == null || (W = N.trpc) === null || W === void 0
            ? void 0
            : W.abortOnUnmount) !== null && U !== void 0
          ? U
          : ae.abortOnUnmount;
    fw(
      (0, fe.default)(
        (0, fe.default)({}, N),
        {},
        {
          initialPageParam:
            (ne = N.initialCursor) !== null && ne !== void 0 ? ne : null,
          queryKey: te,
          queryFn: se
            ? V
            : (B) => {
                var K;
                const le = (0, fe.default)(
                  (0, fe.default)({}, ce),
                  {},
                  {
                    trpc: (0, fe.default)(
                      (0, fe.default)({}, ce?.trpc),
                      A ? { signal: B.signal } : {},
                    ),
                  },
                );
                return ae.client.query(
                  ...Rt(te, le, {
                    pageParam:
                      (K = B.pageParam) !== null && K !== void 0
                        ? K
                        : N.initialCursor,
                    direction: B.direction,
                  }),
                );
              },
        },
      ),
    );
  }
  function j(Q, V, N) {
    var U, W, ne;
    const ae = h(),
      te = Mn(Q, V, "infinite"),
      oe = ae.queryClient.getQueryDefaults(te),
      se = m(te, (0, fe.default)((0, fe.default)({}, oe), N)),
      ce =
        (U =
          N == null || (W = N.trpc) === null || W === void 0
            ? void 0
            : W.abortOnUnmount) !== null && U !== void 0
          ? U
          : ae.abortOnUnmount,
      A = sw(
        (0, fe.default)(
          (0, fe.default)({}, N),
          {},
          {
            initialPageParam:
              (ne = N.initialCursor) !== null && ne !== void 0 ? ne : null,
            queryKey: te,
            queryFn: (B) => {
              var K;
              const le = (0, fe.default)(
                (0, fe.default)({}, se),
                {},
                {
                  trpc: (0, fe.default)(
                    (0, fe.default)({}, se?.trpc),
                    ce ? { signal: B.signal } : {},
                  ),
                },
              );
              return ae.client.query(
                ...Rt(te, le, {
                  pageParam:
                    (K = B.pageParam) !== null && K !== void 0
                      ? K
                      : N.initialCursor,
                  direction: B.direction,
                }),
              );
            },
          },
        ),
        ae.queryClient,
      );
    return ((A.trpc = Tl({ path: Q })), [A.data, A]);
  }
  return {
    Provider: d,
    createClient: c,
    useContext: h,
    useUtils: h,
    useQuery: p,
    usePrefetchQuery: g,
    useSuspenseQuery: v,
    useQueries: (Q, V) => {
      const { ssrState: N, queryClient: U, prefetchQuery: W, client: ne } = h(),
        ae = ly(ne),
        te = Q(ae);
      if (typeof window > "u" && N === "prepass")
        for (const se of te) {
          var oe;
          const ce = se;
          ((oe = ce.trpc) === null || oe === void 0 ? void 0 : oe.ssr) !== !1 &&
            !U.getQueryCache().find({ queryKey: ce.queryKey }) &&
            W(ce.queryKey, ce);
        }
      return Ng(
        {
          queries: te.map((se) =>
            (0, fe.default)(
              (0, fe.default)({}, se),
              {},
              { queryKey: se.queryKey },
            ),
          ),
          combine: V?.combine,
        },
        U,
      );
    },
    useSuspenseQueries: (Q) => {
      const { queryClient: V, client: N } = h(),
        U = ly(N),
        W = Q(U),
        ne = uw(
          {
            queries: W.map((ae) =>
              (0, fe.default)(
                (0, fe.default)({}, ae),
                {},
                { queryFn: ae.queryFn, queryKey: ae.queryKey },
              ),
            ),
          },
          V,
        );
      return [ne.map((ae) => ae.data), ne];
    },
    useMutation: w,
    useSubscription: S,
    useInfiniteQuery: R,
    usePrefetchInfiniteQuery: M,
    useSuspenseInfiniteQuery: j,
  };
}
function UE(n) {
  const a = OE(n);
  return Rd((i) =>
    i === "useContext" || i === "useUtils"
      ? () => {
          const o = n.useUtils();
          return b.useMemo(() => RE(o), [o]);
        }
      : n.hasOwnProperty(i)
        ? n[i]
        : a[i],
  );
}
function LE(n) {
  const a = zE();
  return UE(a);
}
const rr = LE(),
  HE = "Please login (10001)";
var _f = { exports: {} },
  _l = {},
  Af = { exports: {} },
  Rf = {};
var sy;
function BE() {
  return (
    sy ||
      ((sy = 1),
      (function (n) {
        function a(A, B) {
          var K = A.length;
          A.push(B);
          e: for (; 0 < K; ) {
            var le = (K - 1) >>> 1,
              J = A[le];
            if (0 < s(J, B)) ((A[le] = B), (A[K] = J), (K = le));
            else break e;
          }
        }
        function i(A) {
          return A.length === 0 ? null : A[0];
        }
        function o(A) {
          if (A.length === 0) return null;
          var B = A[0],
            K = A.pop();
          if (K !== B) {
            A[0] = K;
            e: for (var le = 0, J = A.length, T = J >>> 1; le < T; ) {
              var G = 2 * (le + 1) - 1,
                k = A[G],
                I = G + 1,
                ee = A[I];
              if (0 > s(k, K))
                I < J && 0 > s(ee, k)
                  ? ((A[le] = ee), (A[I] = K), (le = I))
                  : ((A[le] = k), (A[G] = K), (le = G));
              else if (I < J && 0 > s(ee, K))
                ((A[le] = ee), (A[I] = K), (le = I));
              else break e;
            }
          }
          return B;
        }
        function s(A, B) {
          var K = A.sortIndex - B.sortIndex;
          return K !== 0 ? K : A.id - B.id;
        }
        if (
          ((n.unstable_now = void 0),
          typeof performance == "object" &&
            typeof performance.now == "function")
        ) {
          var c = performance;
          n.unstable_now = function () {
            return c.now();
          };
        } else {
          var d = Date,
            h = d.now();
          n.unstable_now = function () {
            return d.now() - h;
          };
        }
        var m = [],
          p = [],
          g = 1,
          v = null,
          w = 3,
          E = !1,
          C = !1,
          S = !1,
          R = !1,
          M = typeof setTimeout == "function" ? setTimeout : null,
          j = typeof clearTimeout == "function" ? clearTimeout : null,
          q = typeof setImmediate < "u" ? setImmediate : null;
        function Z(A) {
          for (var B = i(p); B !== null; ) {
            if (B.callback === null) o(p);
            else if (B.startTime <= A)
              (o(p), (B.sortIndex = B.expirationTime), a(m, B));
            else break;
            B = i(p);
          }
        }
        function Q(A) {
          if (((S = !1), Z(A), !C))
            if (i(m) !== null) ((C = !0), V || ((V = !0), te()));
            else {
              var B = i(p);
              B !== null && ce(Q, B.startTime - A);
            }
        }
        var V = !1,
          N = -1,
          U = 5,
          W = -1;
        function ne() {
          return R ? !0 : !(n.unstable_now() - W < U);
        }
        function ae() {
          if (((R = !1), V)) {
            var A = n.unstable_now();
            W = A;
            var B = !0;
            try {
              e: {
                ((C = !1), S && ((S = !1), j(N), (N = -1)), (E = !0));
                var K = w;
                try {
                  t: {
                    for (
                      Z(A), v = i(m);
                      v !== null && !(v.expirationTime > A && ne());
                    ) {
                      var le = v.callback;
                      if (typeof le == "function") {
                        ((v.callback = null), (w = v.priorityLevel));
                        var J = le(v.expirationTime <= A);
                        if (((A = n.unstable_now()), typeof J == "function")) {
                          ((v.callback = J), Z(A), (B = !0));
                          break t;
                        }
                        (v === i(m) && o(m), Z(A));
                      } else o(m);
                      v = i(m);
                    }
                    if (v !== null) B = !0;
                    else {
                      var T = i(p);
                      (T !== null && ce(Q, T.startTime - A), (B = !1));
                    }
                  }
                  break e;
                } finally {
                  ((v = null), (w = K), (E = !1));
                }
                B = void 0;
              }
            } finally {
              B ? te() : (V = !1);
            }
          }
        }
        var te;
        if (typeof q == "function")
          te = function () {
            q(ae);
          };
        else if (typeof MessageChannel < "u") {
          var oe = new MessageChannel(),
            se = oe.port2;
          ((oe.port1.onmessage = ae),
            (te = function () {
              se.postMessage(null);
            }));
        } else
          te = function () {
            M(ae, 0);
          };
        function ce(A, B) {
          N = M(function () {
            A(n.unstable_now());
          }, B);
        }
        ((n.unstable_IdlePriority = 5),
          (n.unstable_ImmediatePriority = 1),
          (n.unstable_LowPriority = 4),
          (n.unstable_NormalPriority = 3),
          (n.unstable_Profiling = null),
          (n.unstable_UserBlockingPriority = 2),
          (n.unstable_cancelCallback = function (A) {
            A.callback = null;
          }),
          (n.unstable_forceFrameRate = function (A) {
            0 > A || 125 < A
              ? console.error(
                  "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported",
                )
              : (U = 0 < A ? Math.floor(1e3 / A) : 5);
          }),
          (n.unstable_getCurrentPriorityLevel = function () {
            return w;
          }),
          (n.unstable_next = function (A) {
            switch (w) {
              case 1:
              case 2:
              case 3:
                var B = 3;
                break;
              default:
                B = w;
            }
            var K = w;
            w = B;
            try {
              return A();
            } finally {
              w = K;
            }
          }),
          (n.unstable_requestPaint = function () {
            R = !0;
          }),
          (n.unstable_runWithPriority = function (A, B) {
            switch (A) {
              case 1:
              case 2:
              case 3:
              case 4:
              case 5:
                break;
              default:
                A = 3;
            }
            var K = w;
            w = A;
            try {
              return B();
            } finally {
              w = K;
            }
          }),
          (n.unstable_scheduleCallback = function (A, B, K) {
            var le = n.unstable_now();
            switch (
              (typeof K == "object" && K !== null
                ? ((K = K.delay),
                  (K = typeof K == "number" && 0 < K ? le + K : le))
                : (K = le),
              A)
            ) {
              case 1:
                var J = -1;
                break;
              case 2:
                J = 250;
                break;
              case 5:
                J = 1073741823;
                break;
              case 4:
                J = 1e4;
                break;
              default:
                J = 5e3;
            }
            return (
              (J = K + J),
              (A = {
                id: g++,
                callback: B,
                priorityLevel: A,
                startTime: K,
                expirationTime: J,
                sortIndex: -1,
              }),
              K > le
                ? ((A.sortIndex = K),
                  a(p, A),
                  i(m) === null &&
                    A === i(p) &&
                    (S ? (j(N), (N = -1)) : (S = !0), ce(Q, K - le)))
                : ((A.sortIndex = J),
                  a(m, A),
                  C || E || ((C = !0), V || ((V = !0), te()))),
              A
            );
          }),
          (n.unstable_shouldYield = ne),
          (n.unstable_wrapCallback = function (A) {
            var B = w;
            return function () {
              var K = w;
              w = B;
              try {
                return A.apply(this, arguments);
              } finally {
                w = K;
              }
            };
          }));
      })(Rf)),
    Rf
  );
}
var uy;
function qE() {
  return (uy || ((uy = 1), (Af.exports = BE())), Af.exports);
}
var Mf = { exports: {} },
  St = {};
var cy;
function PE() {
  if (cy) return St;
  cy = 1;
  var n = Qs();
  function a(m) {
    var p = "https://react.dev/errors/" + m;
    if (1 < arguments.length) {
      p += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var g = 2; g < arguments.length; g++)
        p += "&args[]=" + encodeURIComponent(arguments[g]);
    }
    return (
      "Minified React error #" +
      m +
      "; visit " +
      p +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function i() {}
  var o = {
      d: {
        f: i,
        r: function () {
          throw Error(a(522));
        },
        D: i,
        C: i,
        L: i,
        m: i,
        X: i,
        S: i,
        M: i,
      },
      p: 0,
      findDOMNode: null,
    },
    s = Symbol.for("react.portal");
  function c(m, p, g) {
    var v =
      3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: s,
      key: v == null ? null : "" + v,
      children: m,
      containerInfo: p,
      implementation: g,
    };
  }
  var d = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function h(m, p) {
    if (m === "font") return "";
    if (typeof p == "string") return p === "use-credentials" ? p : "";
  }
  return (
    (St.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = o),
    (St.createPortal = function (m, p) {
      var g =
        2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
      if (!p || (p.nodeType !== 1 && p.nodeType !== 9 && p.nodeType !== 11))
        throw Error(a(299));
      return c(m, p, null, g);
    }),
    (St.flushSync = function (m) {
      var p = d.T,
        g = o.p;
      try {
        if (((d.T = null), (o.p = 2), m)) return m();
      } finally {
        ((d.T = p), (o.p = g), o.d.f());
      }
    }),
    (St.preconnect = function (m, p) {
      typeof m == "string" &&
        (p
          ? ((p = p.crossOrigin),
            (p =
              typeof p == "string"
                ? p === "use-credentials"
                  ? p
                  : ""
                : void 0))
          : (p = null),
        o.d.C(m, p));
    }),
    (St.prefetchDNS = function (m) {
      typeof m == "string" && o.d.D(m);
    }),
    (St.preinit = function (m, p) {
      if (typeof m == "string" && p && typeof p.as == "string") {
        var g = p.as,
          v = h(g, p.crossOrigin),
          w = typeof p.integrity == "string" ? p.integrity : void 0,
          E = typeof p.fetchPriority == "string" ? p.fetchPriority : void 0;
        g === "style"
          ? o.d.S(m, typeof p.precedence == "string" ? p.precedence : void 0, {
              crossOrigin: v,
              integrity: w,
              fetchPriority: E,
            })
          : g === "script" &&
            o.d.X(m, {
              crossOrigin: v,
              integrity: w,
              fetchPriority: E,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            });
      }
    }),
    (St.preinitModule = function (m, p) {
      if (typeof m == "string")
        if (typeof p == "object" && p !== null) {
          if (p.as == null || p.as === "script") {
            var g = h(p.as, p.crossOrigin);
            o.d.M(m, {
              crossOrigin: g,
              integrity: typeof p.integrity == "string" ? p.integrity : void 0,
              nonce: typeof p.nonce == "string" ? p.nonce : void 0,
            });
          }
        } else p == null && o.d.M(m);
    }),
    (St.preload = function (m, p) {
      if (
        typeof m == "string" &&
        typeof p == "object" &&
        p !== null &&
        typeof p.as == "string"
      ) {
        var g = p.as,
          v = h(g, p.crossOrigin);
        o.d.L(m, g, {
          crossOrigin: v,
          integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          nonce: typeof p.nonce == "string" ? p.nonce : void 0,
          type: typeof p.type == "string" ? p.type : void 0,
          fetchPriority:
            typeof p.fetchPriority == "string" ? p.fetchPriority : void 0,
          referrerPolicy:
            typeof p.referrerPolicy == "string" ? p.referrerPolicy : void 0,
          imageSrcSet:
            typeof p.imageSrcSet == "string" ? p.imageSrcSet : void 0,
          imageSizes: typeof p.imageSizes == "string" ? p.imageSizes : void 0,
          media: typeof p.media == "string" ? p.media : void 0,
        });
      }
    }),
    (St.preloadModule = function (m, p) {
      if (typeof m == "string")
        if (p) {
          var g = h(p.as, p.crossOrigin);
          o.d.m(m, {
            as: typeof p.as == "string" && p.as !== "script" ? p.as : void 0,
            crossOrigin: g,
            integrity: typeof p.integrity == "string" ? p.integrity : void 0,
          });
        } else o.d.m(m);
    }),
    (St.requestFormReset = function (m) {
      o.d.r(m);
    }),
    (St.unstable_batchedUpdates = function (m, p) {
      return m(p);
    }),
    (St.useFormState = function (m, p, g) {
      return d.H.useFormState(m, p, g);
    }),
    (St.useFormStatus = function () {
      return d.H.useHostTransitionStatus();
    }),
    (St.version = "19.2.4"),
    St
  );
}
var fy;
function Jg() {
  if (fy) return Mf.exports;
  fy = 1;
  function n() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (a) {
        console.error(a);
      }
  }
  return (n(), (Mf.exports = PE()), Mf.exports);
}
var dy;
function kE() {
  if (dy) return _l;
  dy = 1;
  var n = qE(),
    a = Qs(),
    i = Jg();
  function o(e) {
    var t = "https://react.dev/errors/" + e;
    if (1 < arguments.length) {
      t += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var r = 2; r < arguments.length; r++)
        t += "&args[]=" + encodeURIComponent(arguments[r]);
    }
    return (
      "Minified React error #" +
      e +
      "; visit " +
      t +
      " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    );
  }
  function s(e) {
    return !(!e || (e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11));
  }
  function c(e) {
    var t = e,
      r = e;
    if (e.alternate) for (; t.return; ) t = t.return;
    else {
      e = t;
      do ((t = e), (t.flags & 4098) !== 0 && (r = t.return), (e = t.return));
      while (e);
    }
    return t.tag === 3 ? r : null;
  }
  function d(e) {
    if (e.tag === 13) {
      var t = e.memoizedState;
      if (
        (t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function h(e) {
    if (e.tag === 31) {
      var t = e.memoizedState;
      if (
        (t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)),
        t !== null)
      )
        return t.dehydrated;
    }
    return null;
  }
  function m(e) {
    if (c(e) !== e) throw Error(o(188));
  }
  function p(e) {
    var t = e.alternate;
    if (!t) {
      if (((t = c(e)), t === null)) throw Error(o(188));
      return t !== e ? null : e;
    }
    for (var r = e, l = t; ; ) {
      var u = r.return;
      if (u === null) break;
      var f = u.alternate;
      if (f === null) {
        if (((l = u.return), l !== null)) {
          r = l;
          continue;
        }
        break;
      }
      if (u.child === f.child) {
        for (f = u.child; f; ) {
          if (f === r) return (m(u), e);
          if (f === l) return (m(u), t);
          f = f.sibling;
        }
        throw Error(o(188));
      }
      if (r.return !== l.return) ((r = u), (l = f));
      else {
        for (var y = !1, x = u.child; x; ) {
          if (x === r) {
            ((y = !0), (r = u), (l = f));
            break;
          }
          if (x === l) {
            ((y = !0), (l = u), (r = f));
            break;
          }
          x = x.sibling;
        }
        if (!y) {
          for (x = f.child; x; ) {
            if (x === r) {
              ((y = !0), (r = f), (l = u));
              break;
            }
            if (x === l) {
              ((y = !0), (l = f), (r = u));
              break;
            }
            x = x.sibling;
          }
          if (!y) throw Error(o(189));
        }
      }
      if (r.alternate !== l) throw Error(o(190));
    }
    if (r.tag !== 3) throw Error(o(188));
    return r.stateNode.current === r ? e : t;
  }
  function g(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e;
    for (e = e.child; e !== null; ) {
      if (((t = g(e)), t !== null)) return t;
      e = e.sibling;
    }
    return null;
  }
  var v = Object.assign,
    w = Symbol.for("react.element"),
    E = Symbol.for("react.transitional.element"),
    C = Symbol.for("react.portal"),
    S = Symbol.for("react.fragment"),
    R = Symbol.for("react.strict_mode"),
    M = Symbol.for("react.profiler"),
    j = Symbol.for("react.consumer"),
    q = Symbol.for("react.context"),
    Z = Symbol.for("react.forward_ref"),
    Q = Symbol.for("react.suspense"),
    V = Symbol.for("react.suspense_list"),
    N = Symbol.for("react.memo"),
    U = Symbol.for("react.lazy"),
    W = Symbol.for("react.activity"),
    ne = Symbol.for("react.memo_cache_sentinel"),
    ae = Symbol.iterator;
  function te(e) {
    return e === null || typeof e != "object"
      ? null
      : ((e = (ae && e[ae]) || e["@@iterator"]),
        typeof e == "function" ? e : null);
  }
  var oe = Symbol.for("react.client.reference");
  function se(e) {
    if (e == null) return null;
    if (typeof e == "function")
      return e.$$typeof === oe ? null : e.displayName || e.name || null;
    if (typeof e == "string") return e;
    switch (e) {
      case S:
        return "Fragment";
      case M:
        return "Profiler";
      case R:
        return "StrictMode";
      case Q:
        return "Suspense";
      case V:
        return "SuspenseList";
      case W:
        return "Activity";
    }
    if (typeof e == "object")
      switch (e.$$typeof) {
        case C:
          return "Portal";
        case q:
          return e.displayName || "Context";
        case j:
          return (e._context.displayName || "Context") + ".Consumer";
        case Z:
          var t = e.render;
          return (
            (e = e.displayName),
            e ||
              ((e = t.displayName || t.name || ""),
              (e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef")),
            e
          );
        case N:
          return (
            (t = e.displayName || null),
            t !== null ? t : se(e.type) || "Memo"
          );
        case U:
          ((t = e._payload), (e = e._init));
          try {
            return se(e(t));
          } catch {}
      }
    return null;
  }
  var ce = Array.isArray,
    A = a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    B = i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
    K = { pending: !1, data: null, method: null, action: null },
    le = [],
    J = -1;
  function T(e) {
    return { current: e };
  }
  function G(e) {
    0 > J || ((e.current = le[J]), (le[J] = null), J--);
  }
  function k(e, t) {
    (J++, (le[J] = e.current), (e.current = t));
  }
  var I = T(null),
    ee = T(null),
    ue = T(null),
    re = T(null);
  function de(e, t) {
    switch ((k(ue, t), k(ee, e), k(I, null), t.nodeType)) {
      case 9:
      case 11:
        e = (e = t.documentElement) && (e = e.namespaceURI) ? cv(e) : 0;
        break;
      default:
        if (((e = t.tagName), (t = t.namespaceURI)))
          ((t = cv(t)), (e = fv(t, e)));
        else
          switch (e) {
            case "svg":
              e = 1;
              break;
            case "math":
              e = 2;
              break;
            default:
              e = 0;
          }
    }
    (G(I), k(I, e));
  }
  function pe() {
    (G(I), G(ee), G(ue));
  }
  function Oe(e) {
    e.memoizedState !== null && k(re, e);
    var t = I.current,
      r = fv(t, e.type);
    t !== r && (k(ee, e), k(I, r));
  }
  function Ce(e) {
    (ee.current === e && (G(I), G(ee)),
      re.current === e && (G(re), (Sl._currentValue = K)));
  }
  var Re, et;
  function Ke(e) {
    if (Re === void 0)
      try {
        throw Error();
      } catch (r) {
        var t = r.stack.trim().match(/\n( *(at )?)/);
        ((Re = (t && t[1]) || ""),
          (et =
            -1 <
            r.stack.indexOf(`
    at`)
              ? " (<anonymous>)"
              : -1 < r.stack.indexOf("@")
                ? "@unknown:0:0"
                : ""));
      }
    return (
      `
` +
      Re +
      e +
      et
    );
  }
  var Ln = !1;
  function Sn(e, t) {
    if (!e || Ln) return "";
    Ln = !0;
    var r = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = {
        DetermineComponentFrameRoot: function () {
          try {
            if (t) {
              var $ = function () {
                throw Error();
              };
              if (
                (Object.defineProperty($.prototype, "props", {
                  set: function () {
                    throw Error();
                  },
                }),
                typeof Reflect == "object" && Reflect.construct)
              ) {
                try {
                  Reflect.construct($, []);
                } catch (Y) {
                  var P = Y;
                }
                Reflect.construct(e, [], $);
              } else {
                try {
                  $.call();
                } catch (Y) {
                  P = Y;
                }
                e.call($.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (Y) {
                P = Y;
              }
              ($ = e()) &&
                typeof $.catch == "function" &&
                $.catch(function () {});
            }
          } catch (Y) {
            if (Y && P && typeof Y.stack == "string") return [Y.stack, P.stack];
          }
          return [null, null];
        },
      };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var u = Object.getOwnPropertyDescriptor(
        l.DetermineComponentFrameRoot,
        "name",
      );
      u &&
        u.configurable &&
        Object.defineProperty(l.DetermineComponentFrameRoot, "name", {
          value: "DetermineComponentFrameRoot",
        });
      var f = l.DetermineComponentFrameRoot(),
        y = f[0],
        x = f[1];
      if (y && x) {
        var _ = y.split(`
`),
          H = x.split(`
`);
        for (
          u = l = 0;
          l < _.length && !_[l].includes("DetermineComponentFrameRoot");
        )
          l++;
        for (; u < H.length && !H[u].includes("DetermineComponentFrameRoot"); )
          u++;
        if (l === _.length || u === H.length)
          for (
            l = _.length - 1, u = H.length - 1;
            1 <= l && 0 <= u && _[l] !== H[u];
          )
            u--;
        for (; 1 <= l && 0 <= u; l--, u--)
          if (_[l] !== H[u]) {
            if (l !== 1 || u !== 1)
              do
                if ((l--, u--, 0 > u || _[l] !== H[u])) {
                  var X =
                    `
` + _[l].replace(" at new ", " at ");
                  return (
                    e.displayName &&
                      X.includes("<anonymous>") &&
                      (X = X.replace("<anonymous>", e.displayName)),
                    X
                  );
                }
              while (1 <= l && 0 <= u);
            break;
          }
      }
    } finally {
      ((Ln = !1), (Error.prepareStackTrace = r));
    }
    return (r = e ? e.displayName || e.name : "") ? Ke(r) : "";
  }
  function cn(e, t) {
    switch (e.tag) {
      case 26:
      case 27:
      case 5:
        return Ke(e.type);
      case 16:
        return Ke("Lazy");
      case 13:
        return e.child !== t && t !== null
          ? Ke("Suspense Fallback")
          : Ke("Suspense");
      case 19:
        return Ke("SuspenseList");
      case 0:
      case 15:
        return Sn(e.type, !1);
      case 11:
        return Sn(e.type.render, !1);
      case 1:
        return Sn(e.type, !0);
      case 31:
        return Ke("Activity");
      default:
        return "";
    }
  }
  function Ni(e) {
    try {
      var t = "",
        r = null;
      do ((t += cn(e, r)), (r = e), (e = e.return));
      while (e);
      return t;
    } catch (l) {
      return (
        `
Error generating stack: ` +
        l.message +
        `
` +
        l.stack
      );
    }
  }
  var kt = Object.prototype.hasOwnProperty,
    Di = n.unstable_scheduleCallback,
    ji = n.unstable_cancelCallback,
    Ct = n.unstable_shouldYield,
    ur = n.unstable_requestPaint,
    Tt = n.unstable_now,
    su = n.unstable_getCurrentPriorityLevel,
    Fr = n.unstable_ImmediatePriority,
    Fl = n.unstable_UserBlockingPriority,
    $r = n.unstable_NormalPriority,
    zi = n.unstable_LowPriority,
    Hn = n.unstable_IdlePriority,
    $l = n.log,
    cr = n.unstable_setDisableYieldValue,
    Jr = null,
    _t = null;
  function fn(e) {
    if (
      (typeof $l == "function" && cr(e),
      _t && typeof _t.setStrictMode == "function")
    )
      try {
        _t.setStrictMode(Jr, e);
      } catch {}
  }
  var bt = Math.clz32 ? Math.clz32 : wn,
    uu = Math.log,
    Ui = Math.LN2;
  function wn(e) {
    return ((e >>>= 0), e === 0 ? 32 : (31 - ((uu(e) / Ui) | 0)) | 0);
  }
  var Na = 256,
    Da = 262144,
    Wr = 4194304;
  function En(e) {
    var t = e & 42;
    if (t !== 0) return t;
    switch (e & -e) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return e & 261888;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return e & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return e;
    }
  }
  function xe(e, t, r) {
    var l = e.pendingLanes;
    if (l === 0) return 0;
    var u = 0,
      f = e.suspendedLanes,
      y = e.pingedLanes;
    e = e.warmLanes;
    var x = l & 134217727;
    return (
      x !== 0
        ? ((l = x & ~f),
          l !== 0
            ? (u = En(l))
            : ((y &= x),
              y !== 0
                ? (u = En(y))
                : r || ((r = x & ~e), r !== 0 && (u = En(r)))))
        : ((x = l & ~f),
          x !== 0
            ? (u = En(x))
            : y !== 0
              ? (u = En(y))
              : r || ((r = l & ~e), r !== 0 && (u = En(r)))),
      u === 0
        ? 0
        : t !== 0 &&
            t !== u &&
            (t & f) === 0 &&
            ((f = u & -u),
            (r = t & -t),
            f >= r || (f === 32 && (r & 4194048) !== 0))
          ? t
          : u
    );
  }
  function Xe(e, t) {
    return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
  }
  function ft(e, t) {
    switch (e) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return t + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function xt() {
    var e = Wr;
    return ((Wr <<= 1), (Wr & 62914560) === 0 && (Wr = 4194304), e);
  }
  function fr(e) {
    for (var t = [], r = 0; 31 > r; r++) t.push(e);
    return t;
  }
  function Ze(e, t) {
    ((e.pendingLanes |= t),
      t !== 268435456 &&
        ((e.suspendedLanes = 0), (e.pingedLanes = 0), (e.warmLanes = 0)));
  }
  function Mt(e, t, r, l, u, f) {
    var y = e.pendingLanes;
    ((e.pendingLanes = r),
      (e.suspendedLanes = 0),
      (e.pingedLanes = 0),
      (e.warmLanes = 0),
      (e.expiredLanes &= r),
      (e.entangledLanes &= r),
      (e.errorRecoveryDisabledLanes &= r),
      (e.shellSuspendCounter = 0));
    var x = e.entanglements,
      _ = e.expirationTimes,
      H = e.hiddenUpdates;
    for (r = y & ~r; 0 < r; ) {
      var X = 31 - bt(r),
        $ = 1 << X;
      ((x[X] = 0), (_[X] = -1));
      var P = H[X];
      if (P !== null)
        for (H[X] = null, X = 0; X < P.length; X++) {
          var Y = P[X];
          Y !== null && (Y.lane &= -536870913);
        }
      r &= ~$;
    }
    (l !== 0 && ea(e, l, 0),
      f !== 0 && u === 0 && e.tag !== 0 && (e.suspendedLanes |= f & ~(y & ~t)));
  }
  function ea(e, t, r) {
    ((e.pendingLanes |= t), (e.suspendedLanes &= ~t));
    var l = 31 - bt(t);
    ((e.entangledLanes |= t),
      (e.entanglements[l] = e.entanglements[l] | 1073741824 | (r & 261930)));
  }
  function Nt(e, t) {
    var r = (e.entangledLanes |= t);
    for (e = e.entanglements; r; ) {
      var l = 31 - bt(r),
        u = 1 << l;
      ((u & t) | (e[l] & t) && (e[l] |= t), (r &= ~u));
    }
  }
  function Dt(e, t) {
    var r = t & -t;
    return (
      (r = (r & 42) !== 0 ? 1 : ja(r)),
      (r & (e.suspendedLanes | t)) !== 0 ? 0 : r
    );
  }
  function ja(e) {
    switch (e) {
      case 2:
        e = 1;
        break;
      case 8:
        e = 4;
        break;
      case 32:
        e = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        e = 128;
        break;
      case 268435456:
        e = 134217728;
        break;
      default:
        e = 0;
    }
    return e;
  }
  function dn(e) {
    return (
      (e &= -e),
      2 < e ? (8 < e ? ((e & 134217727) !== 0 ? 32 : 268435456) : 8) : 2
    );
  }
  function cu() {
    var e = B.p;
    return e !== 0 ? e : ((e = window.event), e === void 0 ? 32 : zv(e.type));
  }
  function Fd(e, t) {
    var r = B.p;
    try {
      return ((B.p = e), t());
    } finally {
      B.p = r;
    }
  }
  var dr = Math.random().toString(36).slice(2),
    mt = "__reactFiber$" + dr,
    jt = "__reactProps$" + dr,
    za = "__reactContainer$" + dr,
    fu = "__reactEvents$" + dr,
    mx = "__reactListeners$" + dr,
    px = "__reactHandles$" + dr,
    $d = "__reactResources$" + dr,
    Li = "__reactMarker$" + dr;
  function du(e) {
    (delete e[mt], delete e[jt], delete e[fu], delete e[mx], delete e[px]);
  }
  function Ua(e) {
    var t = e[mt];
    if (t) return t;
    for (var r = e.parentNode; r; ) {
      if ((t = r[za] || r[mt])) {
        if (
          ((r = t.alternate),
          t.child !== null || (r !== null && r.child !== null))
        )
          for (e = gv(e); e !== null; ) {
            if ((r = e[mt])) return r;
            e = gv(e);
          }
        return t;
      }
      ((e = r), (r = e.parentNode));
    }
    return null;
  }
  function La(e) {
    if ((e = e[mt] || e[za])) {
      var t = e.tag;
      if (
        t === 5 ||
        t === 6 ||
        t === 13 ||
        t === 31 ||
        t === 26 ||
        t === 27 ||
        t === 3
      )
        return e;
    }
    return null;
  }
  function Hi(e) {
    var t = e.tag;
    if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
    throw Error(o(33));
  }
  function Ha(e) {
    var t = e[$d];
    return (
      t ||
        (t = e[$d] =
          { hoistableStyles: new Map(), hoistableScripts: new Map() }),
      t
    );
  }
  function dt(e) {
    e[Li] = !0;
  }
  var Jd = new Set(),
    Wd = {};
  function ta(e, t) {
    (Ba(e, t), Ba(e + "Capture", t));
  }
  function Ba(e, t) {
    for (Wd[e] = t, e = 0; e < t.length; e++) Jd.add(t[e]);
  }
  var vx = RegExp(
      "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$",
    ),
    eh = {},
    th = {};
  function yx(e) {
    return kt.call(th, e)
      ? !0
      : kt.call(eh, e)
        ? !1
        : vx.test(e)
          ? (th[e] = !0)
          : ((eh[e] = !0), !1);
  }
  function Jl(e, t, r) {
    if (yx(t))
      if (r === null) e.removeAttribute(t);
      else {
        switch (typeof r) {
          case "undefined":
          case "function":
          case "symbol":
            e.removeAttribute(t);
            return;
          case "boolean":
            var l = t.toLowerCase().slice(0, 5);
            if (l !== "data-" && l !== "aria-") {
              e.removeAttribute(t);
              return;
            }
        }
        e.setAttribute(t, "" + r);
      }
  }
  function Wl(e, t, r) {
    if (r === null) e.removeAttribute(t);
    else {
      switch (typeof r) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(t);
          return;
      }
      e.setAttribute(t, "" + r);
    }
  }
  function Bn(e, t, r, l) {
    if (l === null) e.removeAttribute(r);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          e.removeAttribute(r);
          return;
      }
      e.setAttributeNS(t, r, "" + l);
    }
  }
  function Jt(e) {
    switch (typeof e) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return e;
      case "object":
        return e;
      default:
        return "";
    }
  }
  function nh(e) {
    var t = e.type;
    return (
      (e = e.nodeName) &&
      e.toLowerCase() === "input" &&
      (t === "checkbox" || t === "radio")
    );
  }
  function gx(e, t, r) {
    var l = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
    if (
      !e.hasOwnProperty(t) &&
      typeof l < "u" &&
      typeof l.get == "function" &&
      typeof l.set == "function"
    ) {
      var u = l.get,
        f = l.set;
      return (
        Object.defineProperty(e, t, {
          configurable: !0,
          get: function () {
            return u.call(this);
          },
          set: function (y) {
            ((r = "" + y), f.call(this, y));
          },
        }),
        Object.defineProperty(e, t, { enumerable: l.enumerable }),
        {
          getValue: function () {
            return r;
          },
          setValue: function (y) {
            r = "" + y;
          },
          stopTracking: function () {
            ((e._valueTracker = null), delete e[t]);
          },
        }
      );
    }
  }
  function hu(e) {
    if (!e._valueTracker) {
      var t = nh(e) ? "checked" : "value";
      e._valueTracker = gx(e, t, "" + e[t]);
    }
  }
  function rh(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var r = t.getValue(),
      l = "";
    return (
      e && (l = nh(e) ? (e.checked ? "true" : "false") : e.value),
      (e = l),
      e !== r ? (t.setValue(e), !0) : !1
    );
  }
  function eo(e) {
    if (
      ((e = e || (typeof document < "u" ? document : void 0)), typeof e > "u")
    )
      return null;
    try {
      return e.activeElement || e.body;
    } catch {
      return e.body;
    }
  }
  var bx = /[\n"\\]/g;
  function Wt(e) {
    return e.replace(bx, function (t) {
      return "\\" + t.charCodeAt(0).toString(16) + " ";
    });
  }
  function mu(e, t, r, l, u, f, y, x) {
    ((e.name = ""),
      y != null &&
      typeof y != "function" &&
      typeof y != "symbol" &&
      typeof y != "boolean"
        ? (e.type = y)
        : e.removeAttribute("type"),
      t != null
        ? y === "number"
          ? ((t === 0 && e.value === "") || e.value != t) &&
            (e.value = "" + Jt(t))
          : e.value !== "" + Jt(t) && (e.value = "" + Jt(t))
        : (y !== "submit" && y !== "reset") || e.removeAttribute("value"),
      t != null
        ? pu(e, y, Jt(t))
        : r != null
          ? pu(e, y, Jt(r))
          : l != null && e.removeAttribute("value"),
      u == null && f != null && (e.defaultChecked = !!f),
      u != null &&
        (e.checked = u && typeof u != "function" && typeof u != "symbol"),
      x != null &&
      typeof x != "function" &&
      typeof x != "symbol" &&
      typeof x != "boolean"
        ? (e.name = "" + Jt(x))
        : e.removeAttribute("name"));
  }
  function ah(e, t, r, l, u, f, y, x) {
    if (
      (f != null &&
        typeof f != "function" &&
        typeof f != "symbol" &&
        typeof f != "boolean" &&
        (e.type = f),
      t != null || r != null)
    ) {
      if (!((f !== "submit" && f !== "reset") || t != null)) {
        hu(e);
        return;
      }
      ((r = r != null ? "" + Jt(r) : ""),
        (t = t != null ? "" + Jt(t) : r),
        x || t === e.value || (e.value = t),
        (e.defaultValue = t));
    }
    ((l = l ?? u),
      (l = typeof l != "function" && typeof l != "symbol" && !!l),
      (e.checked = x ? e.checked : !!l),
      (e.defaultChecked = !!l),
      y != null &&
        typeof y != "function" &&
        typeof y != "symbol" &&
        typeof y != "boolean" &&
        (e.name = y),
      hu(e));
  }
  function pu(e, t, r) {
    (t === "number" && eo(e.ownerDocument) === e) ||
      e.defaultValue === "" + r ||
      (e.defaultValue = "" + r);
  }
  function qa(e, t, r, l) {
    if (((e = e.options), t)) {
      t = {};
      for (var u = 0; u < r.length; u++) t["$" + r[u]] = !0;
      for (r = 0; r < e.length; r++)
        ((u = t.hasOwnProperty("$" + e[r].value)),
          e[r].selected !== u && (e[r].selected = u),
          u && l && (e[r].defaultSelected = !0));
    } else {
      for (r = "" + Jt(r), t = null, u = 0; u < e.length; u++) {
        if (e[u].value === r) {
          ((e[u].selected = !0), l && (e[u].defaultSelected = !0));
          return;
        }
        t !== null || e[u].disabled || (t = e[u]);
      }
      t !== null && (t.selected = !0);
    }
  }
  function ih(e, t, r) {
    if (
      t != null &&
      ((t = "" + Jt(t)), t !== e.value && (e.value = t), r == null)
    ) {
      e.defaultValue !== t && (e.defaultValue = t);
      return;
    }
    e.defaultValue = r != null ? "" + Jt(r) : "";
  }
  function lh(e, t, r, l) {
    if (t == null) {
      if (l != null) {
        if (r != null) throw Error(o(92));
        if (ce(l)) {
          if (1 < l.length) throw Error(o(93));
          l = l[0];
        }
        r = l;
      }
      (r == null && (r = ""), (t = r));
    }
    ((r = Jt(t)),
      (e.defaultValue = r),
      (l = e.textContent),
      l === r && l !== "" && l !== null && (e.value = l),
      hu(e));
  }
  function Pa(e, t) {
    if (t) {
      var r = e.firstChild;
      if (r && r === e.lastChild && r.nodeType === 3) {
        r.nodeValue = t;
        return;
      }
    }
    e.textContent = t;
  }
  var xx = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " ",
    ),
  );
  function oh(e, t, r) {
    var l = t.indexOf("--") === 0;
    r == null || typeof r == "boolean" || r === ""
      ? l
        ? e.setProperty(t, "")
        : t === "float"
          ? (e.cssFloat = "")
          : (e[t] = "")
      : l
        ? e.setProperty(t, r)
        : typeof r != "number" || r === 0 || xx.has(t)
          ? t === "float"
            ? (e.cssFloat = r)
            : (e[t] = ("" + r).trim())
          : (e[t] = r + "px");
  }
  function sh(e, t, r) {
    if (t != null && typeof t != "object") throw Error(o(62));
    if (((e = e.style), r != null)) {
      for (var l in r)
        !r.hasOwnProperty(l) ||
          (t != null && t.hasOwnProperty(l)) ||
          (l.indexOf("--") === 0
            ? e.setProperty(l, "")
            : l === "float"
              ? (e.cssFloat = "")
              : (e[l] = ""));
      for (var u in t)
        ((l = t[u]), t.hasOwnProperty(u) && r[u] !== l && oh(e, u, l));
    } else for (var f in t) t.hasOwnProperty(f) && oh(e, f, t[f]);
  }
  function vu(e) {
    if (e.indexOf("-") === -1) return !1;
    switch (e) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var Sx = new Map([
      ["acceptCharset", "accept-charset"],
      ["htmlFor", "for"],
      ["httpEquiv", "http-equiv"],
      ["crossOrigin", "crossorigin"],
      ["accentHeight", "accent-height"],
      ["alignmentBaseline", "alignment-baseline"],
      ["arabicForm", "arabic-form"],
      ["baselineShift", "baseline-shift"],
      ["capHeight", "cap-height"],
      ["clipPath", "clip-path"],
      ["clipRule", "clip-rule"],
      ["colorInterpolation", "color-interpolation"],
      ["colorInterpolationFilters", "color-interpolation-filters"],
      ["colorProfile", "color-profile"],
      ["colorRendering", "color-rendering"],
      ["dominantBaseline", "dominant-baseline"],
      ["enableBackground", "enable-background"],
      ["fillOpacity", "fill-opacity"],
      ["fillRule", "fill-rule"],
      ["floodColor", "flood-color"],
      ["floodOpacity", "flood-opacity"],
      ["fontFamily", "font-family"],
      ["fontSize", "font-size"],
      ["fontSizeAdjust", "font-size-adjust"],
      ["fontStretch", "font-stretch"],
      ["fontStyle", "font-style"],
      ["fontVariant", "font-variant"],
      ["fontWeight", "font-weight"],
      ["glyphName", "glyph-name"],
      ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
      ["glyphOrientationVertical", "glyph-orientation-vertical"],
      ["horizAdvX", "horiz-adv-x"],
      ["horizOriginX", "horiz-origin-x"],
      ["imageRendering", "image-rendering"],
      ["letterSpacing", "letter-spacing"],
      ["lightingColor", "lighting-color"],
      ["markerEnd", "marker-end"],
      ["markerMid", "marker-mid"],
      ["markerStart", "marker-start"],
      ["overlinePosition", "overline-position"],
      ["overlineThickness", "overline-thickness"],
      ["paintOrder", "paint-order"],
      ["panose-1", "panose-1"],
      ["pointerEvents", "pointer-events"],
      ["renderingIntent", "rendering-intent"],
      ["shapeRendering", "shape-rendering"],
      ["stopColor", "stop-color"],
      ["stopOpacity", "stop-opacity"],
      ["strikethroughPosition", "strikethrough-position"],
      ["strikethroughThickness", "strikethrough-thickness"],
      ["strokeDasharray", "stroke-dasharray"],
      ["strokeDashoffset", "stroke-dashoffset"],
      ["strokeLinecap", "stroke-linecap"],
      ["strokeLinejoin", "stroke-linejoin"],
      ["strokeMiterlimit", "stroke-miterlimit"],
      ["strokeOpacity", "stroke-opacity"],
      ["strokeWidth", "stroke-width"],
      ["textAnchor", "text-anchor"],
      ["textDecoration", "text-decoration"],
      ["textRendering", "text-rendering"],
      ["transformOrigin", "transform-origin"],
      ["underlinePosition", "underline-position"],
      ["underlineThickness", "underline-thickness"],
      ["unicodeBidi", "unicode-bidi"],
      ["unicodeRange", "unicode-range"],
      ["unitsPerEm", "units-per-em"],
      ["vAlphabetic", "v-alphabetic"],
      ["vHanging", "v-hanging"],
      ["vIdeographic", "v-ideographic"],
      ["vMathematical", "v-mathematical"],
      ["vectorEffect", "vector-effect"],
      ["vertAdvY", "vert-adv-y"],
      ["vertOriginX", "vert-origin-x"],
      ["vertOriginY", "vert-origin-y"],
      ["wordSpacing", "word-spacing"],
      ["writingMode", "writing-mode"],
      ["xmlnsXlink", "xmlns:xlink"],
      ["xHeight", "x-height"],
    ]),
    wx =
      /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function to(e) {
    return wx.test("" + e)
      ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
      : e;
  }
  function qn() {}
  var yu = null;
  function gu(e) {
    return (
      (e = e.target || e.srcElement || window),
      e.correspondingUseElement && (e = e.correspondingUseElement),
      e.nodeType === 3 ? e.parentNode : e
    );
  }
  var ka = null,
    Qa = null;
  function uh(e) {
    var t = La(e);
    if (t && (e = t.stateNode)) {
      var r = e[jt] || null;
      e: switch (((e = t.stateNode), t.type)) {
        case "input":
          if (
            (mu(
              e,
              r.value,
              r.defaultValue,
              r.defaultValue,
              r.checked,
              r.defaultChecked,
              r.type,
              r.name,
            ),
            (t = r.name),
            r.type === "radio" && t != null)
          ) {
            for (r = e; r.parentNode; ) r = r.parentNode;
            for (
              r = r.querySelectorAll(
                'input[name="' + Wt("" + t) + '"][type="radio"]',
              ),
                t = 0;
              t < r.length;
              t++
            ) {
              var l = r[t];
              if (l !== e && l.form === e.form) {
                var u = l[jt] || null;
                if (!u) throw Error(o(90));
                mu(
                  l,
                  u.value,
                  u.defaultValue,
                  u.defaultValue,
                  u.checked,
                  u.defaultChecked,
                  u.type,
                  u.name,
                );
              }
            }
            for (t = 0; t < r.length; t++)
              ((l = r[t]), l.form === e.form && rh(l));
          }
          break e;
        case "textarea":
          ih(e, r.value, r.defaultValue);
          break e;
        case "select":
          ((t = r.value), t != null && qa(e, !!r.multiple, t, !1));
      }
    }
  }
  var bu = !1;
  function ch(e, t, r) {
    if (bu) return e(t, r);
    bu = !0;
    try {
      var l = e(t);
      return l;
    } finally {
      if (
        ((bu = !1),
        (ka !== null || Qa !== null) &&
          (Vo(), ka && ((t = ka), (e = Qa), (Qa = ka = null), uh(t), e)))
      )
        for (t = 0; t < e.length; t++) uh(e[t]);
    }
  }
  function Bi(e, t) {
    var r = e.stateNode;
    if (r === null) return null;
    var l = r[jt] || null;
    if (l === null) return null;
    r = l[t];
    e: switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        ((l = !l.disabled) ||
          ((e = e.type),
          (l = !(
            e === "button" ||
            e === "input" ||
            e === "select" ||
            e === "textarea"
          ))),
          (e = !l));
        break e;
      default:
        e = !1;
    }
    if (e) return null;
    if (r && typeof r != "function") throw Error(o(231, t, typeof r));
    return r;
  }
  var Pn = !(
      typeof window > "u" ||
      typeof window.document > "u" ||
      typeof window.document.createElement > "u"
    ),
    xu = !1;
  if (Pn)
    try {
      var qi = {};
      (Object.defineProperty(qi, "passive", {
        get: function () {
          xu = !0;
        },
      }),
        window.addEventListener("test", qi, qi),
        window.removeEventListener("test", qi, qi));
    } catch {
      xu = !1;
    }
  var hr = null,
    Su = null,
    no = null;
  function fh() {
    if (no) return no;
    var e,
      t = Su,
      r = t.length,
      l,
      u = "value" in hr ? hr.value : hr.textContent,
      f = u.length;
    for (e = 0; e < r && t[e] === u[e]; e++);
    var y = r - e;
    for (l = 1; l <= y && t[r - l] === u[f - l]; l++);
    return (no = u.slice(e, 1 < l ? 1 - l : void 0));
  }
  function ro(e) {
    var t = e.keyCode;
    return (
      "charCode" in e
        ? ((e = e.charCode), e === 0 && t === 13 && (e = 13))
        : (e = t),
      e === 10 && (e = 13),
      32 <= e || e === 13 ? e : 0
    );
  }
  function ao() {
    return !0;
  }
  function dh() {
    return !1;
  }
  function zt(e) {
    function t(r, l, u, f, y) {
      ((this._reactName = r),
        (this._targetInst = u),
        (this.type = l),
        (this.nativeEvent = f),
        (this.target = y),
        (this.currentTarget = null));
      for (var x in e)
        e.hasOwnProperty(x) && ((r = e[x]), (this[x] = r ? r(f) : f[x]));
      return (
        (this.isDefaultPrevented = (
          f.defaultPrevented != null ? f.defaultPrevented : f.returnValue === !1
        )
          ? ao
          : dh),
        (this.isPropagationStopped = dh),
        this
      );
    }
    return (
      v(t.prototype, {
        preventDefault: function () {
          this.defaultPrevented = !0;
          var r = this.nativeEvent;
          r &&
            (r.preventDefault
              ? r.preventDefault()
              : typeof r.returnValue != "unknown" && (r.returnValue = !1),
            (this.isDefaultPrevented = ao));
        },
        stopPropagation: function () {
          var r = this.nativeEvent;
          r &&
            (r.stopPropagation
              ? r.stopPropagation()
              : typeof r.cancelBubble != "unknown" && (r.cancelBubble = !0),
            (this.isPropagationStopped = ao));
        },
        persist: function () {},
        isPersistent: ao,
      }),
      t
    );
  }
  var na = {
      eventPhase: 0,
      bubbles: 0,
      cancelable: 0,
      timeStamp: function (e) {
        return e.timeStamp || Date.now();
      },
      defaultPrevented: 0,
      isTrusted: 0,
    },
    io = zt(na),
    Pi = v({}, na, { view: 0, detail: 0 }),
    Ex = zt(Pi),
    wu,
    Eu,
    ki,
    lo = v({}, Pi, {
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      getModifierState: Cu,
      button: 0,
      buttons: 0,
      relatedTarget: function (e) {
        return e.relatedTarget === void 0
          ? e.fromElement === e.srcElement
            ? e.toElement
            : e.fromElement
          : e.relatedTarget;
      },
      movementX: function (e) {
        return "movementX" in e
          ? e.movementX
          : (e !== ki &&
              (ki && e.type === "mousemove"
                ? ((wu = e.screenX - ki.screenX), (Eu = e.screenY - ki.screenY))
                : (Eu = wu = 0),
              (ki = e)),
            wu);
      },
      movementY: function (e) {
        return "movementY" in e ? e.movementY : Eu;
      },
    }),
    hh = zt(lo),
    Ox = v({}, lo, { dataTransfer: 0 }),
    Cx = zt(Ox),
    Tx = v({}, Pi, { relatedTarget: 0 }),
    Ou = zt(Tx),
    _x = v({}, na, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }),
    Ax = zt(_x),
    Rx = v({}, na, {
      clipboardData: function (e) {
        return "clipboardData" in e ? e.clipboardData : window.clipboardData;
      },
    }),
    Mx = zt(Rx),
    Nx = v({}, na, { data: 0 }),
    mh = zt(Nx),
    Dx = {
      Esc: "Escape",
      Spacebar: " ",
      Left: "ArrowLeft",
      Up: "ArrowUp",
      Right: "ArrowRight",
      Down: "ArrowDown",
      Del: "Delete",
      Win: "OS",
      Menu: "ContextMenu",
      Apps: "ContextMenu",
      Scroll: "ScrollLock",
      MozPrintableKey: "Unidentified",
    },
    jx = {
      8: "Backspace",
      9: "Tab",
      12: "Clear",
      13: "Enter",
      16: "Shift",
      17: "Control",
      18: "Alt",
      19: "Pause",
      20: "CapsLock",
      27: "Escape",
      32: " ",
      33: "PageUp",
      34: "PageDown",
      35: "End",
      36: "Home",
      37: "ArrowLeft",
      38: "ArrowUp",
      39: "ArrowRight",
      40: "ArrowDown",
      45: "Insert",
      46: "Delete",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "NumLock",
      145: "ScrollLock",
      224: "Meta",
    },
    zx = {
      Alt: "altKey",
      Control: "ctrlKey",
      Meta: "metaKey",
      Shift: "shiftKey",
    };
  function Ux(e) {
    var t = this.nativeEvent;
    return t.getModifierState
      ? t.getModifierState(e)
      : (e = zx[e])
        ? !!t[e]
        : !1;
  }
  function Cu() {
    return Ux;
  }
  var Lx = v({}, Pi, {
      key: function (e) {
        if (e.key) {
          var t = Dx[e.key] || e.key;
          if (t !== "Unidentified") return t;
        }
        return e.type === "keypress"
          ? ((e = ro(e)), e === 13 ? "Enter" : String.fromCharCode(e))
          : e.type === "keydown" || e.type === "keyup"
            ? jx[e.keyCode] || "Unidentified"
            : "";
      },
      code: 0,
      location: 0,
      ctrlKey: 0,
      shiftKey: 0,
      altKey: 0,
      metaKey: 0,
      repeat: 0,
      locale: 0,
      getModifierState: Cu,
      charCode: function (e) {
        return e.type === "keypress" ? ro(e) : 0;
      },
      keyCode: function (e) {
        return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
      },
      which: function (e) {
        return e.type === "keypress"
          ? ro(e)
          : e.type === "keydown" || e.type === "keyup"
            ? e.keyCode
            : 0;
      },
    }),
    Hx = zt(Lx),
    Bx = v({}, lo, {
      pointerId: 0,
      width: 0,
      height: 0,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      pointerType: 0,
      isPrimary: 0,
    }),
    ph = zt(Bx),
    qx = v({}, Pi, {
      touches: 0,
      targetTouches: 0,
      changedTouches: 0,
      altKey: 0,
      metaKey: 0,
      ctrlKey: 0,
      shiftKey: 0,
      getModifierState: Cu,
    }),
    Px = zt(qx),
    kx = v({}, na, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }),
    Qx = zt(kx),
    Vx = v({}, lo, {
      deltaX: function (e) {
        return "deltaX" in e
          ? e.deltaX
          : "wheelDeltaX" in e
            ? -e.wheelDeltaX
            : 0;
      },
      deltaY: function (e) {
        return "deltaY" in e
          ? e.deltaY
          : "wheelDeltaY" in e
            ? -e.wheelDeltaY
            : "wheelDelta" in e
              ? -e.wheelDelta
              : 0;
      },
      deltaZ: 0,
      deltaMode: 0,
    }),
    Yx = zt(Vx),
    Gx = v({}, na, { newState: 0, oldState: 0 }),
    Kx = zt(Gx),
    Xx = [9, 13, 27, 32],
    Tu = Pn && "CompositionEvent" in window,
    Qi = null;
  Pn && "documentMode" in document && (Qi = document.documentMode);
  var Ix = Pn && "TextEvent" in window && !Qi,
    vh = Pn && (!Tu || (Qi && 8 < Qi && 11 >= Qi)),
    yh = " ",
    gh = !1;
  function bh(e, t) {
    switch (e) {
      case "keyup":
        return Xx.indexOf(t.keyCode) !== -1;
      case "keydown":
        return t.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function xh(e) {
    return (
      (e = e.detail),
      typeof e == "object" && "data" in e ? e.data : null
    );
  }
  var Va = !1;
  function Zx(e, t) {
    switch (e) {
      case "compositionend":
        return xh(t);
      case "keypress":
        return t.which !== 32 ? null : ((gh = !0), yh);
      case "textInput":
        return ((e = t.data), e === yh && gh ? null : e);
      default:
        return null;
    }
  }
  function Fx(e, t) {
    if (Va)
      return e === "compositionend" || (!Tu && bh(e, t))
        ? ((e = fh()), (no = Su = hr = null), (Va = !1), e)
        : null;
    switch (e) {
      case "paste":
        return null;
      case "keypress":
        if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
          if (t.char && 1 < t.char.length) return t.char;
          if (t.which) return String.fromCharCode(t.which);
        }
        return null;
      case "compositionend":
        return vh && t.locale !== "ko" ? null : t.data;
      default:
        return null;
    }
  }
  var $x = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0,
  };
  function Sh(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === "input" ? !!$x[e.type] : t === "textarea";
  }
  function wh(e, t, r, l) {
    (ka ? (Qa ? Qa.push(l) : (Qa = [l])) : (ka = l),
      (t = Fo(t, "onChange")),
      0 < t.length &&
        ((r = new io("onChange", "change", null, r, l)),
        e.push({ event: r, listeners: t })));
  }
  var Vi = null,
    Yi = null;
  function Jx(e) {
    av(e, 0);
  }
  function oo(e) {
    var t = Hi(e);
    if (rh(t)) return e;
  }
  function Eh(e, t) {
    if (e === "change") return t;
  }
  var Oh = !1;
  if (Pn) {
    var _u;
    if (Pn) {
      var Au = "oninput" in document;
      if (!Au) {
        var Ch = document.createElement("div");
        (Ch.setAttribute("oninput", "return;"),
          (Au = typeof Ch.oninput == "function"));
      }
      _u = Au;
    } else _u = !1;
    Oh = _u && (!document.documentMode || 9 < document.documentMode);
  }
  function Th() {
    Vi && (Vi.detachEvent("onpropertychange", _h), (Yi = Vi = null));
  }
  function _h(e) {
    if (e.propertyName === "value" && oo(Yi)) {
      var t = [];
      (wh(t, Yi, e, gu(e)), ch(Jx, t));
    }
  }
  function Wx(e, t, r) {
    e === "focusin"
      ? (Th(), (Vi = t), (Yi = r), Vi.attachEvent("onpropertychange", _h))
      : e === "focusout" && Th();
  }
  function eS(e) {
    if (e === "selectionchange" || e === "keyup" || e === "keydown")
      return oo(Yi);
  }
  function tS(e, t) {
    if (e === "click") return oo(t);
  }
  function nS(e, t) {
    if (e === "input" || e === "change") return oo(t);
  }
  function rS(e, t) {
    return (e === t && (e !== 0 || 1 / e === 1 / t)) || (e !== e && t !== t);
  }
  var Qt = typeof Object.is == "function" ? Object.is : rS;
  function Gi(e, t) {
    if (Qt(e, t)) return !0;
    if (
      typeof e != "object" ||
      e === null ||
      typeof t != "object" ||
      t === null
    )
      return !1;
    var r = Object.keys(e),
      l = Object.keys(t);
    if (r.length !== l.length) return !1;
    for (l = 0; l < r.length; l++) {
      var u = r[l];
      if (!kt.call(t, u) || !Qt(e[u], t[u])) return !1;
    }
    return !0;
  }
  function Ah(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
  }
  function Rh(e, t) {
    var r = Ah(e);
    e = 0;
    for (var l; r; ) {
      if (r.nodeType === 3) {
        if (((l = e + r.textContent.length), e <= t && l >= t))
          return { node: r, offset: t - e };
        e = l;
      }
      e: {
        for (; r; ) {
          if (r.nextSibling) {
            r = r.nextSibling;
            break e;
          }
          r = r.parentNode;
        }
        r = void 0;
      }
      r = Ah(r);
    }
  }
  function Mh(e, t) {
    return e && t
      ? e === t
        ? !0
        : e && e.nodeType === 3
          ? !1
          : t && t.nodeType === 3
            ? Mh(e, t.parentNode)
            : "contains" in e
              ? e.contains(t)
              : e.compareDocumentPosition
                ? !!(e.compareDocumentPosition(t) & 16)
                : !1
      : !1;
  }
  function Nh(e) {
    e =
      e != null &&
      e.ownerDocument != null &&
      e.ownerDocument.defaultView != null
        ? e.ownerDocument.defaultView
        : window;
    for (var t = eo(e.document); t instanceof e.HTMLIFrameElement; ) {
      try {
        var r = typeof t.contentWindow.location.href == "string";
      } catch {
        r = !1;
      }
      if (r) e = t.contentWindow;
      else break;
      t = eo(e.document);
    }
    return t;
  }
  function Ru(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return (
      t &&
      ((t === "input" &&
        (e.type === "text" ||
          e.type === "search" ||
          e.type === "tel" ||
          e.type === "url" ||
          e.type === "password")) ||
        t === "textarea" ||
        e.contentEditable === "true")
    );
  }
  var aS = Pn && "documentMode" in document && 11 >= document.documentMode,
    Ya = null,
    Mu = null,
    Ki = null,
    Nu = !1;
  function Dh(e, t, r) {
    var l =
      r.window === r ? r.document : r.nodeType === 9 ? r : r.ownerDocument;
    Nu ||
      Ya == null ||
      Ya !== eo(l) ||
      ((l = Ya),
      "selectionStart" in l && Ru(l)
        ? (l = { start: l.selectionStart, end: l.selectionEnd })
        : ((l = (
            (l.ownerDocument && l.ownerDocument.defaultView) ||
            window
          ).getSelection()),
          (l = {
            anchorNode: l.anchorNode,
            anchorOffset: l.anchorOffset,
            focusNode: l.focusNode,
            focusOffset: l.focusOffset,
          })),
      (Ki && Gi(Ki, l)) ||
        ((Ki = l),
        (l = Fo(Mu, "onSelect")),
        0 < l.length &&
          ((t = new io("onSelect", "select", null, t, r)),
          e.push({ event: t, listeners: l }),
          (t.target = Ya))));
  }
  function ra(e, t) {
    var r = {};
    return (
      (r[e.toLowerCase()] = t.toLowerCase()),
      (r["Webkit" + e] = "webkit" + t),
      (r["Moz" + e] = "moz" + t),
      r
    );
  }
  var Ga = {
      animationend: ra("Animation", "AnimationEnd"),
      animationiteration: ra("Animation", "AnimationIteration"),
      animationstart: ra("Animation", "AnimationStart"),
      transitionrun: ra("Transition", "TransitionRun"),
      transitionstart: ra("Transition", "TransitionStart"),
      transitioncancel: ra("Transition", "TransitionCancel"),
      transitionend: ra("Transition", "TransitionEnd"),
    },
    Du = {},
    jh = {};
  Pn &&
    ((jh = document.createElement("div").style),
    "AnimationEvent" in window ||
      (delete Ga.animationend.animation,
      delete Ga.animationiteration.animation,
      delete Ga.animationstart.animation),
    "TransitionEvent" in window || delete Ga.transitionend.transition);
  function aa(e) {
    if (Du[e]) return Du[e];
    if (!Ga[e]) return e;
    var t = Ga[e],
      r;
    for (r in t) if (t.hasOwnProperty(r) && r in jh) return (Du[e] = t[r]);
    return e;
  }
  var zh = aa("animationend"),
    Uh = aa("animationiteration"),
    Lh = aa("animationstart"),
    iS = aa("transitionrun"),
    lS = aa("transitionstart"),
    oS = aa("transitioncancel"),
    Hh = aa("transitionend"),
    Bh = new Map(),
    ju =
      "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
        " ",
      );
  ju.push("scrollEnd");
  function hn(e, t) {
    (Bh.set(e, t), ta(t, [e]));
  }
  var so =
      typeof reportError == "function"
        ? reportError
        : function (e) {
            if (
              typeof window == "object" &&
              typeof window.ErrorEvent == "function"
            ) {
              var t = new window.ErrorEvent("error", {
                bubbles: !0,
                cancelable: !0,
                message:
                  typeof e == "object" &&
                  e !== null &&
                  typeof e.message == "string"
                    ? String(e.message)
                    : String(e),
                error: e,
              });
              if (!window.dispatchEvent(t)) return;
            } else if (
              typeof process == "object" &&
              typeof process.emit == "function"
            ) {
              process.emit("uncaughtException", e);
              return;
            }
            console.error(e);
          },
    en = [],
    Ka = 0,
    zu = 0;
  function uo() {
    for (var e = Ka, t = (zu = Ka = 0); t < e; ) {
      var r = en[t];
      en[t++] = null;
      var l = en[t];
      en[t++] = null;
      var u = en[t];
      en[t++] = null;
      var f = en[t];
      if (((en[t++] = null), l !== null && u !== null)) {
        var y = l.pending;
        (y === null ? (u.next = u) : ((u.next = y.next), (y.next = u)),
          (l.pending = u));
      }
      f !== 0 && qh(r, u, f);
    }
  }
  function co(e, t, r, l) {
    ((en[Ka++] = e),
      (en[Ka++] = t),
      (en[Ka++] = r),
      (en[Ka++] = l),
      (zu |= l),
      (e.lanes |= l),
      (e = e.alternate),
      e !== null && (e.lanes |= l));
  }
  function Uu(e, t, r, l) {
    return (co(e, t, r, l), fo(e));
  }
  function ia(e, t) {
    return (co(e, null, null, t), fo(e));
  }
  function qh(e, t, r) {
    e.lanes |= r;
    var l = e.alternate;
    l !== null && (l.lanes |= r);
    for (var u = !1, f = e.return; f !== null; )
      ((f.childLanes |= r),
        (l = f.alternate),
        l !== null && (l.childLanes |= r),
        f.tag === 22 &&
          ((e = f.stateNode), e === null || e._visibility & 1 || (u = !0)),
        (e = f),
        (f = f.return));
    return e.tag === 3
      ? ((f = e.stateNode),
        u &&
          t !== null &&
          ((u = 31 - bt(r)),
          (e = f.hiddenUpdates),
          (l = e[u]),
          l === null ? (e[u] = [t]) : l.push(t),
          (t.lane = r | 536870912)),
        f)
      : null;
  }
  function fo(e) {
    if (50 < ml) throw ((ml = 0), (Yc = null), Error(o(185)));
    for (var t = e.return; t !== null; ) ((e = t), (t = e.return));
    return e.tag === 3 ? e.stateNode : null;
  }
  var Xa = {};
  function sS(e, t, r, l) {
    ((this.tag = e),
      (this.key = r),
      (this.sibling =
        this.child =
        this.return =
        this.stateNode =
        this.type =
        this.elementType =
          null),
      (this.index = 0),
      (this.refCleanup = this.ref = null),
      (this.pendingProps = t),
      (this.dependencies =
        this.memoizedState =
        this.updateQueue =
        this.memoizedProps =
          null),
      (this.mode = l),
      (this.subtreeFlags = this.flags = 0),
      (this.deletions = null),
      (this.childLanes = this.lanes = 0),
      (this.alternate = null));
  }
  function Vt(e, t, r, l) {
    return new sS(e, t, r, l);
  }
  function Lu(e) {
    return ((e = e.prototype), !(!e || !e.isReactComponent));
  }
  function kn(e, t) {
    var r = e.alternate;
    return (
      r === null
        ? ((r = Vt(e.tag, t, e.key, e.mode)),
          (r.elementType = e.elementType),
          (r.type = e.type),
          (r.stateNode = e.stateNode),
          (r.alternate = e),
          (e.alternate = r))
        : ((r.pendingProps = t),
          (r.type = e.type),
          (r.flags = 0),
          (r.subtreeFlags = 0),
          (r.deletions = null)),
      (r.flags = e.flags & 65011712),
      (r.childLanes = e.childLanes),
      (r.lanes = e.lanes),
      (r.child = e.child),
      (r.memoizedProps = e.memoizedProps),
      (r.memoizedState = e.memoizedState),
      (r.updateQueue = e.updateQueue),
      (t = e.dependencies),
      (r.dependencies =
        t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }),
      (r.sibling = e.sibling),
      (r.index = e.index),
      (r.ref = e.ref),
      (r.refCleanup = e.refCleanup),
      r
    );
  }
  function Ph(e, t) {
    e.flags &= 65011714;
    var r = e.alternate;
    return (
      r === null
        ? ((e.childLanes = 0),
          (e.lanes = t),
          (e.child = null),
          (e.subtreeFlags = 0),
          (e.memoizedProps = null),
          (e.memoizedState = null),
          (e.updateQueue = null),
          (e.dependencies = null),
          (e.stateNode = null))
        : ((e.childLanes = r.childLanes),
          (e.lanes = r.lanes),
          (e.child = r.child),
          (e.subtreeFlags = 0),
          (e.deletions = null),
          (e.memoizedProps = r.memoizedProps),
          (e.memoizedState = r.memoizedState),
          (e.updateQueue = r.updateQueue),
          (e.type = r.type),
          (t = r.dependencies),
          (e.dependencies =
            t === null
              ? null
              : { lanes: t.lanes, firstContext: t.firstContext })),
      e
    );
  }
  function ho(e, t, r, l, u, f) {
    var y = 0;
    if (((l = e), typeof e == "function")) Lu(e) && (y = 1);
    else if (typeof e == "string")
      y = h1(e, r, I.current)
        ? 26
        : e === "html" || e === "head" || e === "body"
          ? 27
          : 5;
    else
      e: switch (e) {
        case W:
          return ((e = Vt(31, r, t, u)), (e.elementType = W), (e.lanes = f), e);
        case S:
          return la(r.children, u, f, t);
        case R:
          ((y = 8), (u |= 24));
          break;
        case M:
          return (
            (e = Vt(12, r, t, u | 2)),
            (e.elementType = M),
            (e.lanes = f),
            e
          );
        case Q:
          return ((e = Vt(13, r, t, u)), (e.elementType = Q), (e.lanes = f), e);
        case V:
          return ((e = Vt(19, r, t, u)), (e.elementType = V), (e.lanes = f), e);
        default:
          if (typeof e == "object" && e !== null)
            switch (e.$$typeof) {
              case q:
                y = 10;
                break e;
              case j:
                y = 9;
                break e;
              case Z:
                y = 11;
                break e;
              case N:
                y = 14;
                break e;
              case U:
                ((y = 16), (l = null));
                break e;
            }
          ((y = 29),
            (r = Error(o(130, e === null ? "null" : typeof e, ""))),
            (l = null));
      }
    return (
      (t = Vt(y, r, t, u)),
      (t.elementType = e),
      (t.type = l),
      (t.lanes = f),
      t
    );
  }
  function la(e, t, r, l) {
    return ((e = Vt(7, e, l, t)), (e.lanes = r), e);
  }
  function Hu(e, t, r) {
    return ((e = Vt(6, e, null, t)), (e.lanes = r), e);
  }
  function kh(e) {
    var t = Vt(18, null, null, 0);
    return ((t.stateNode = e), t);
  }
  function Bu(e, t, r) {
    return (
      (t = Vt(4, e.children !== null ? e.children : [], e.key, t)),
      (t.lanes = r),
      (t.stateNode = {
        containerInfo: e.containerInfo,
        pendingChildren: null,
        implementation: e.implementation,
      }),
      t
    );
  }
  var Qh = new WeakMap();
  function tn(e, t) {
    if (typeof e == "object" && e !== null) {
      var r = Qh.get(e);
      return r !== void 0
        ? r
        : ((t = { value: e, source: t, stack: Ni(t) }), Qh.set(e, t), t);
    }
    return { value: e, source: t, stack: Ni(t) };
  }
  var Ia = [],
    Za = 0,
    mo = null,
    Xi = 0,
    nn = [],
    rn = 0,
    mr = null,
    On = 1,
    Cn = "";
  function Qn(e, t) {
    ((Ia[Za++] = Xi), (Ia[Za++] = mo), (mo = e), (Xi = t));
  }
  function Vh(e, t, r) {
    ((nn[rn++] = On), (nn[rn++] = Cn), (nn[rn++] = mr), (mr = e));
    var l = On;
    e = Cn;
    var u = 32 - bt(l) - 1;
    ((l &= ~(1 << u)), (r += 1));
    var f = 32 - bt(t) + u;
    if (30 < f) {
      var y = u - (u % 5);
      ((f = (l & ((1 << y) - 1)).toString(32)),
        (l >>= y),
        (u -= y),
        (On = (1 << (32 - bt(t) + u)) | (r << u) | l),
        (Cn = f + e));
    } else ((On = (1 << f) | (r << u) | l), (Cn = e));
  }
  function qu(e) {
    e.return !== null && (Qn(e, 1), Vh(e, 1, 0));
  }
  function Pu(e) {
    for (; e === mo; )
      ((mo = Ia[--Za]), (Ia[Za] = null), (Xi = Ia[--Za]), (Ia[Za] = null));
    for (; e === mr; )
      ((mr = nn[--rn]),
        (nn[rn] = null),
        (Cn = nn[--rn]),
        (nn[rn] = null),
        (On = nn[--rn]),
        (nn[rn] = null));
  }
  function Yh(e, t) {
    ((nn[rn++] = On),
      (nn[rn++] = Cn),
      (nn[rn++] = mr),
      (On = t.id),
      (Cn = t.overflow),
      (mr = e));
  }
  var pt = null,
    Ye = null,
    De = !1,
    pr = null,
    an = !1,
    ku = Error(o(519));
  function vr(e) {
    var t = Error(
      o(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1]
          ? "text"
          : "HTML",
        "",
      ),
    );
    throw (Ii(tn(t, e)), ku);
  }
  function Gh(e) {
    var t = e.stateNode,
      r = e.type,
      l = e.memoizedProps;
    switch (((t[mt] = e), (t[jt] = l), r)) {
      case "dialog":
        (Ae("cancel", t), Ae("close", t));
        break;
      case "iframe":
      case "object":
      case "embed":
        Ae("load", t);
        break;
      case "video":
      case "audio":
        for (r = 0; r < vl.length; r++) Ae(vl[r], t);
        break;
      case "source":
        Ae("error", t);
        break;
      case "img":
      case "image":
      case "link":
        (Ae("error", t), Ae("load", t));
        break;
      case "details":
        Ae("toggle", t);
        break;
      case "input":
        (Ae("invalid", t),
          ah(
            t,
            l.value,
            l.defaultValue,
            l.checked,
            l.defaultChecked,
            l.type,
            l.name,
            !0,
          ));
        break;
      case "select":
        Ae("invalid", t);
        break;
      case "textarea":
        (Ae("invalid", t), lh(t, l.value, l.defaultValue, l.children));
    }
    ((r = l.children),
      (typeof r != "string" && typeof r != "number" && typeof r != "bigint") ||
      t.textContent === "" + r ||
      l.suppressHydrationWarning === !0 ||
      sv(t.textContent, r)
        ? (l.popover != null && (Ae("beforetoggle", t), Ae("toggle", t)),
          l.onScroll != null && Ae("scroll", t),
          l.onScrollEnd != null && Ae("scrollend", t),
          l.onClick != null && (t.onclick = qn),
          (t = !0))
        : (t = !1),
      t || vr(e, !0));
  }
  function Kh(e) {
    for (pt = e.return; pt; )
      switch (pt.tag) {
        case 5:
        case 31:
        case 13:
          an = !1;
          return;
        case 27:
        case 3:
          an = !0;
          return;
        default:
          pt = pt.return;
      }
  }
  function Fa(e) {
    if (e !== pt) return !1;
    if (!De) return (Kh(e), (De = !0), !1);
    var t = e.tag,
      r;
    if (
      ((r = t !== 3 && t !== 27) &&
        ((r = t === 5) &&
          ((r = e.type),
          (r =
            !(r !== "form" && r !== "button") || lf(e.type, e.memoizedProps))),
        (r = !r)),
      r && Ye && vr(e),
      Kh(e),
      t === 13)
    ) {
      if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e))
        throw Error(o(317));
      Ye = yv(e);
    } else if (t === 31) {
      if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e))
        throw Error(o(317));
      Ye = yv(e);
    } else
      t === 27
        ? ((t = Ye), Mr(e.type) ? ((e = ff), (ff = null), (Ye = e)) : (Ye = t))
        : (Ye = pt ? on(e.stateNode.nextSibling) : null);
    return !0;
  }
  function oa() {
    ((Ye = pt = null), (De = !1));
  }
  function Qu() {
    var e = pr;
    return (
      e !== null &&
        (Bt === null ? (Bt = e) : Bt.push.apply(Bt, e), (pr = null)),
      e
    );
  }
  function Ii(e) {
    pr === null ? (pr = [e]) : pr.push(e);
  }
  var Vu = T(null),
    sa = null,
    Vn = null;
  function yr(e, t, r) {
    (k(Vu, t._currentValue), (t._currentValue = r));
  }
  function Yn(e) {
    ((e._currentValue = Vu.current), G(Vu));
  }
  function Yu(e, t, r) {
    for (; e !== null; ) {
      var l = e.alternate;
      if (
        ((e.childLanes & t) !== t
          ? ((e.childLanes |= t), l !== null && (l.childLanes |= t))
          : l !== null && (l.childLanes & t) !== t && (l.childLanes |= t),
        e === r)
      )
        break;
      e = e.return;
    }
  }
  function Gu(e, t, r, l) {
    var u = e.child;
    for (u !== null && (u.return = e); u !== null; ) {
      var f = u.dependencies;
      if (f !== null) {
        var y = u.child;
        f = f.firstContext;
        e: for (; f !== null; ) {
          var x = f;
          f = u;
          for (var _ = 0; _ < t.length; _++)
            if (x.context === t[_]) {
              ((f.lanes |= r),
                (x = f.alternate),
                x !== null && (x.lanes |= r),
                Yu(f.return, r, e),
                l || (y = null));
              break e;
            }
          f = x.next;
        }
      } else if (u.tag === 18) {
        if (((y = u.return), y === null)) throw Error(o(341));
        ((y.lanes |= r),
          (f = y.alternate),
          f !== null && (f.lanes |= r),
          Yu(y, r, e),
          (y = null));
      } else y = u.child;
      if (y !== null) y.return = u;
      else
        for (y = u; y !== null; ) {
          if (y === e) {
            y = null;
            break;
          }
          if (((u = y.sibling), u !== null)) {
            ((u.return = y.return), (y = u));
            break;
          }
          y = y.return;
        }
      u = y;
    }
  }
  function $a(e, t, r, l) {
    e = null;
    for (var u = t, f = !1; u !== null; ) {
      if (!f) {
        if ((u.flags & 524288) !== 0) f = !0;
        else if ((u.flags & 262144) !== 0) break;
      }
      if (u.tag === 10) {
        var y = u.alternate;
        if (y === null) throw Error(o(387));
        if (((y = y.memoizedProps), y !== null)) {
          var x = u.type;
          Qt(u.pendingProps.value, y.value) ||
            (e !== null ? e.push(x) : (e = [x]));
        }
      } else if (u === re.current) {
        if (((y = u.alternate), y === null)) throw Error(o(387));
        y.memoizedState.memoizedState !== u.memoizedState.memoizedState &&
          (e !== null ? e.push(Sl) : (e = [Sl]));
      }
      u = u.return;
    }
    (e !== null && Gu(t, e, r, l), (t.flags |= 262144));
  }
  function po(e) {
    for (e = e.firstContext; e !== null; ) {
      if (!Qt(e.context._currentValue, e.memoizedValue)) return !0;
      e = e.next;
    }
    return !1;
  }
  function ua(e) {
    ((sa = e),
      (Vn = null),
      (e = e.dependencies),
      e !== null && (e.firstContext = null));
  }
  function vt(e) {
    return Xh(sa, e);
  }
  function vo(e, t) {
    return (sa === null && ua(e), Xh(e, t));
  }
  function Xh(e, t) {
    var r = t._currentValue;
    if (((t = { context: t, memoizedValue: r, next: null }), Vn === null)) {
      if (e === null) throw Error(o(308));
      ((Vn = t),
        (e.dependencies = { lanes: 0, firstContext: t }),
        (e.flags |= 524288));
    } else Vn = Vn.next = t;
    return r;
  }
  var uS =
      typeof AbortController < "u"
        ? AbortController
        : function () {
            var e = [],
              t = (this.signal = {
                aborted: !1,
                addEventListener: function (r, l) {
                  e.push(l);
                },
              });
            this.abort = function () {
              ((t.aborted = !0),
                e.forEach(function (r) {
                  return r();
                }));
            };
          },
    cS = n.unstable_scheduleCallback,
    fS = n.unstable_NormalPriority,
    at = {
      $$typeof: q,
      Consumer: null,
      Provider: null,
      _currentValue: null,
      _currentValue2: null,
      _threadCount: 0,
    };
  function Ku() {
    return { controller: new uS(), data: new Map(), refCount: 0 };
  }
  function Zi(e) {
    (e.refCount--,
      e.refCount === 0 &&
        cS(fS, function () {
          e.controller.abort();
        }));
  }
  var Fi = null,
    Xu = 0,
    Ja = 0,
    Wa = null;
  function dS(e, t) {
    if (Fi === null) {
      var r = (Fi = []);
      ((Xu = 0),
        (Ja = Fc()),
        (Wa = {
          status: "pending",
          value: void 0,
          then: function (l) {
            r.push(l);
          },
        }));
    }
    return (Xu++, t.then(Ih, Ih), t);
  }
  function Ih() {
    if (--Xu === 0 && Fi !== null) {
      Wa !== null && (Wa.status = "fulfilled");
      var e = Fi;
      ((Fi = null), (Ja = 0), (Wa = null));
      for (var t = 0; t < e.length; t++) (0, e[t])();
    }
  }
  function hS(e, t) {
    var r = [],
      l = {
        status: "pending",
        value: null,
        reason: null,
        then: function (u) {
          r.push(u);
        },
      };
    return (
      e.then(
        function () {
          ((l.status = "fulfilled"), (l.value = t));
          for (var u = 0; u < r.length; u++) (0, r[u])(t);
        },
        function (u) {
          for (l.status = "rejected", l.reason = u, u = 0; u < r.length; u++)
            (0, r[u])(void 0);
        },
      ),
      l
    );
  }
  var Zh = A.S;
  A.S = function (e, t) {
    ((Dp = Tt()),
      typeof t == "object" &&
        t !== null &&
        typeof t.then == "function" &&
        dS(e, t),
      Zh !== null && Zh(e, t));
  };
  var ca = T(null);
  function Iu() {
    var e = ca.current;
    return e !== null ? e : Qe.pooledCache;
  }
  function yo(e, t) {
    t === null ? k(ca, ca.current) : k(ca, t.pool);
  }
  function Fh() {
    var e = Iu();
    return e === null ? null : { parent: at._currentValue, pool: e };
  }
  var ei = Error(o(460)),
    Zu = Error(o(474)),
    go = Error(o(542)),
    bo = { then: function () {} };
  function $h(e) {
    return ((e = e.status), e === "fulfilled" || e === "rejected");
  }
  function Jh(e, t, r) {
    switch (
      ((r = e[r]),
      r === void 0 ? e.push(t) : r !== t && (t.then(qn, qn), (t = r)),
      t.status)
    ) {
      case "fulfilled":
        return t.value;
      case "rejected":
        throw ((e = t.reason), em(e), e);
      default:
        if (typeof t.status == "string") t.then(qn, qn);
        else {
          if (((e = Qe), e !== null && 100 < e.shellSuspendCounter))
            throw Error(o(482));
          ((e = t),
            (e.status = "pending"),
            e.then(
              function (l) {
                if (t.status === "pending") {
                  var u = t;
                  ((u.status = "fulfilled"), (u.value = l));
                }
              },
              function (l) {
                if (t.status === "pending") {
                  var u = t;
                  ((u.status = "rejected"), (u.reason = l));
                }
              },
            ));
        }
        switch (t.status) {
          case "fulfilled":
            return t.value;
          case "rejected":
            throw ((e = t.reason), em(e), e);
        }
        throw ((da = t), ei);
    }
  }
  function fa(e) {
    try {
      var t = e._init;
      return t(e._payload);
    } catch (r) {
      throw r !== null && typeof r == "object" && typeof r.then == "function"
        ? ((da = r), ei)
        : r;
    }
  }
  var da = null;
  function Wh() {
    if (da === null) throw Error(o(459));
    var e = da;
    return ((da = null), e);
  }
  function em(e) {
    if (e === ei || e === go) throw Error(o(483));
  }
  var ti = null,
    $i = 0;
  function xo(e) {
    var t = $i;
    return (($i += 1), ti === null && (ti = []), Jh(ti, e, t));
  }
  function Ji(e, t) {
    ((t = t.props.ref), (e.ref = t !== void 0 ? t : null));
  }
  function So(e, t) {
    throw t.$$typeof === w
      ? Error(o(525))
      : ((e = Object.prototype.toString.call(t)),
        Error(
          o(
            31,
            e === "[object Object]"
              ? "object with keys {" + Object.keys(t).join(", ") + "}"
              : e,
          ),
        ));
  }
  function tm(e) {
    function t(z, D) {
      if (e) {
        var L = z.deletions;
        L === null ? ((z.deletions = [D]), (z.flags |= 16)) : L.push(D);
      }
    }
    function r(z, D) {
      if (!e) return null;
      for (; D !== null; ) (t(z, D), (D = D.sibling));
      return null;
    }
    function l(z) {
      for (var D = new Map(); z !== null; )
        (z.key !== null ? D.set(z.key, z) : D.set(z.index, z), (z = z.sibling));
      return D;
    }
    function u(z, D) {
      return ((z = kn(z, D)), (z.index = 0), (z.sibling = null), z);
    }
    function f(z, D, L) {
      return (
        (z.index = L),
        e
          ? ((L = z.alternate),
            L !== null
              ? ((L = L.index), L < D ? ((z.flags |= 67108866), D) : L)
              : ((z.flags |= 67108866), D))
          : ((z.flags |= 1048576), D)
      );
    }
    function y(z) {
      return (e && z.alternate === null && (z.flags |= 67108866), z);
    }
    function x(z, D, L, F) {
      return D === null || D.tag !== 6
        ? ((D = Hu(L, z.mode, F)), (D.return = z), D)
        : ((D = u(D, L)), (D.return = z), D);
    }
    function _(z, D, L, F) {
      var ge = L.type;
      return ge === S
        ? X(z, D, L.props.children, F, L.key)
        : D !== null &&
            (D.elementType === ge ||
              (typeof ge == "object" &&
                ge !== null &&
                ge.$$typeof === U &&
                fa(ge) === D.type))
          ? ((D = u(D, L.props)), Ji(D, L), (D.return = z), D)
          : ((D = ho(L.type, L.key, L.props, null, z.mode, F)),
            Ji(D, L),
            (D.return = z),
            D);
    }
    function H(z, D, L, F) {
      return D === null ||
        D.tag !== 4 ||
        D.stateNode.containerInfo !== L.containerInfo ||
        D.stateNode.implementation !== L.implementation
        ? ((D = Bu(L, z.mode, F)), (D.return = z), D)
        : ((D = u(D, L.children || [])), (D.return = z), D);
    }
    function X(z, D, L, F, ge) {
      return D === null || D.tag !== 7
        ? ((D = la(L, z.mode, F, ge)), (D.return = z), D)
        : ((D = u(D, L)), (D.return = z), D);
    }
    function $(z, D, L) {
      if (
        (typeof D == "string" && D !== "") ||
        typeof D == "number" ||
        typeof D == "bigint"
      )
        return ((D = Hu("" + D, z.mode, L)), (D.return = z), D);
      if (typeof D == "object" && D !== null) {
        switch (D.$$typeof) {
          case E:
            return (
              (L = ho(D.type, D.key, D.props, null, z.mode, L)),
              Ji(L, D),
              (L.return = z),
              L
            );
          case C:
            return ((D = Bu(D, z.mode, L)), (D.return = z), D);
          case U:
            return ((D = fa(D)), $(z, D, L));
        }
        if (ce(D) || te(D))
          return ((D = la(D, z.mode, L, null)), (D.return = z), D);
        if (typeof D.then == "function") return $(z, xo(D), L);
        if (D.$$typeof === q) return $(z, vo(z, D), L);
        So(z, D);
      }
      return null;
    }
    function P(z, D, L, F) {
      var ge = D !== null ? D.key : null;
      if (
        (typeof L == "string" && L !== "") ||
        typeof L == "number" ||
        typeof L == "bigint"
      )
        return ge !== null ? null : x(z, D, "" + L, F);
      if (typeof L == "object" && L !== null) {
        switch (L.$$typeof) {
          case E:
            return L.key === ge ? _(z, D, L, F) : null;
          case C:
            return L.key === ge ? H(z, D, L, F) : null;
          case U:
            return ((L = fa(L)), P(z, D, L, F));
        }
        if (ce(L) || te(L)) return ge !== null ? null : X(z, D, L, F, null);
        if (typeof L.then == "function") return P(z, D, xo(L), F);
        if (L.$$typeof === q) return P(z, D, vo(z, L), F);
        So(z, L);
      }
      return null;
    }
    function Y(z, D, L, F, ge) {
      if (
        (typeof F == "string" && F !== "") ||
        typeof F == "number" ||
        typeof F == "bigint"
      )
        return ((z = z.get(L) || null), x(D, z, "" + F, ge));
      if (typeof F == "object" && F !== null) {
        switch (F.$$typeof) {
          case E:
            return (
              (z = z.get(F.key === null ? L : F.key) || null),
              _(D, z, F, ge)
            );
          case C:
            return (
              (z = z.get(F.key === null ? L : F.key) || null),
              H(D, z, F, ge)
            );
          case U:
            return ((F = fa(F)), Y(z, D, L, F, ge));
        }
        if (ce(F) || te(F))
          return ((z = z.get(L) || null), X(D, z, F, ge, null));
        if (typeof F.then == "function") return Y(z, D, L, xo(F), ge);
        if (F.$$typeof === q) return Y(z, D, L, vo(D, F), ge);
        So(D, F);
      }
      return null;
    }
    function he(z, D, L, F) {
      for (
        var ge = null, je = null, ye = D, Ee = (D = 0), Ne = null;
        ye !== null && Ee < L.length;
        Ee++
      ) {
        ye.index > Ee ? ((Ne = ye), (ye = null)) : (Ne = ye.sibling);
        var ze = P(z, ye, L[Ee], F);
        if (ze === null) {
          ye === null && (ye = Ne);
          break;
        }
        (e && ye && ze.alternate === null && t(z, ye),
          (D = f(ze, D, Ee)),
          je === null ? (ge = ze) : (je.sibling = ze),
          (je = ze),
          (ye = Ne));
      }
      if (Ee === L.length) return (r(z, ye), De && Qn(z, Ee), ge);
      if (ye === null) {
        for (; Ee < L.length; Ee++)
          ((ye = $(z, L[Ee], F)),
            ye !== null &&
              ((D = f(ye, D, Ee)),
              je === null ? (ge = ye) : (je.sibling = ye),
              (je = ye)));
        return (De && Qn(z, Ee), ge);
      }
      for (ye = l(ye); Ee < L.length; Ee++)
        ((Ne = Y(ye, z, Ee, L[Ee], F)),
          Ne !== null &&
            (e &&
              Ne.alternate !== null &&
              ye.delete(Ne.key === null ? Ee : Ne.key),
            (D = f(Ne, D, Ee)),
            je === null ? (ge = Ne) : (je.sibling = Ne),
            (je = Ne)));
      return (
        e &&
          ye.forEach(function (Ur) {
            return t(z, Ur);
          }),
        De && Qn(z, Ee),
        ge
      );
    }
    function be(z, D, L, F) {
      if (L == null) throw Error(o(151));
      for (
        var ge = null,
          je = null,
          ye = D,
          Ee = (D = 0),
          Ne = null,
          ze = L.next();
        ye !== null && !ze.done;
        Ee++, ze = L.next()
      ) {
        ye.index > Ee ? ((Ne = ye), (ye = null)) : (Ne = ye.sibling);
        var Ur = P(z, ye, ze.value, F);
        if (Ur === null) {
          ye === null && (ye = Ne);
          break;
        }
        (e && ye && Ur.alternate === null && t(z, ye),
          (D = f(Ur, D, Ee)),
          je === null ? (ge = Ur) : (je.sibling = Ur),
          (je = Ur),
          (ye = Ne));
      }
      if (ze.done) return (r(z, ye), De && Qn(z, Ee), ge);
      if (ye === null) {
        for (; !ze.done; Ee++, ze = L.next())
          ((ze = $(z, ze.value, F)),
            ze !== null &&
              ((D = f(ze, D, Ee)),
              je === null ? (ge = ze) : (je.sibling = ze),
              (je = ze)));
        return (De && Qn(z, Ee), ge);
      }
      for (ye = l(ye); !ze.done; Ee++, ze = L.next())
        ((ze = Y(ye, z, Ee, ze.value, F)),
          ze !== null &&
            (e &&
              ze.alternate !== null &&
              ye.delete(ze.key === null ? Ee : ze.key),
            (D = f(ze, D, Ee)),
            je === null ? (ge = ze) : (je.sibling = ze),
            (je = ze)));
      return (
        e &&
          ye.forEach(function (O1) {
            return t(z, O1);
          }),
        De && Qn(z, Ee),
        ge
      );
    }
    function ke(z, D, L, F) {
      if (
        (typeof L == "object" &&
          L !== null &&
          L.type === S &&
          L.key === null &&
          (L = L.props.children),
        typeof L == "object" && L !== null)
      ) {
        switch (L.$$typeof) {
          case E:
            e: {
              for (var ge = L.key; D !== null; ) {
                if (D.key === ge) {
                  if (((ge = L.type), ge === S)) {
                    if (D.tag === 7) {
                      (r(z, D.sibling),
                        (F = u(D, L.props.children)),
                        (F.return = z),
                        (z = F));
                      break e;
                    }
                  } else if (
                    D.elementType === ge ||
                    (typeof ge == "object" &&
                      ge !== null &&
                      ge.$$typeof === U &&
                      fa(ge) === D.type)
                  ) {
                    (r(z, D.sibling),
                      (F = u(D, L.props)),
                      Ji(F, L),
                      (F.return = z),
                      (z = F));
                    break e;
                  }
                  r(z, D);
                  break;
                } else t(z, D);
                D = D.sibling;
              }
              L.type === S
                ? ((F = la(L.props.children, z.mode, F, L.key)),
                  (F.return = z),
                  (z = F))
                : ((F = ho(L.type, L.key, L.props, null, z.mode, F)),
                  Ji(F, L),
                  (F.return = z),
                  (z = F));
            }
            return y(z);
          case C:
            e: {
              for (ge = L.key; D !== null; ) {
                if (D.key === ge)
                  if (
                    D.tag === 4 &&
                    D.stateNode.containerInfo === L.containerInfo &&
                    D.stateNode.implementation === L.implementation
                  ) {
                    (r(z, D.sibling),
                      (F = u(D, L.children || [])),
                      (F.return = z),
                      (z = F));
                    break e;
                  } else {
                    r(z, D);
                    break;
                  }
                else t(z, D);
                D = D.sibling;
              }
              ((F = Bu(L, z.mode, F)), (F.return = z), (z = F));
            }
            return y(z);
          case U:
            return ((L = fa(L)), ke(z, D, L, F));
        }
        if (ce(L)) return he(z, D, L, F);
        if (te(L)) {
          if (((ge = te(L)), typeof ge != "function")) throw Error(o(150));
          return ((L = ge.call(L)), be(z, D, L, F));
        }
        if (typeof L.then == "function") return ke(z, D, xo(L), F);
        if (L.$$typeof === q) return ke(z, D, vo(z, L), F);
        So(z, L);
      }
      return (typeof L == "string" && L !== "") ||
        typeof L == "number" ||
        typeof L == "bigint"
        ? ((L = "" + L),
          D !== null && D.tag === 6
            ? (r(z, D.sibling), (F = u(D, L)), (F.return = z), (z = F))
            : (r(z, D), (F = Hu(L, z.mode, F)), (F.return = z), (z = F)),
          y(z))
        : r(z, D);
    }
    return function (z, D, L, F) {
      try {
        $i = 0;
        var ge = ke(z, D, L, F);
        return ((ti = null), ge);
      } catch (ye) {
        if (ye === ei || ye === go) throw ye;
        var je = Vt(29, ye, null, z.mode);
        return ((je.lanes = F), (je.return = z), je);
      }
    };
  }
  var ha = tm(!0),
    nm = tm(!1),
    gr = !1;
  function Fu(e) {
    e.updateQueue = {
      baseState: e.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null,
    };
  }
  function $u(e, t) {
    ((e = e.updateQueue),
      t.updateQueue === e &&
        (t.updateQueue = {
          baseState: e.baseState,
          firstBaseUpdate: e.firstBaseUpdate,
          lastBaseUpdate: e.lastBaseUpdate,
          shared: e.shared,
          callbacks: null,
        }));
  }
  function br(e) {
    return { lane: e, tag: 0, payload: null, callback: null, next: null };
  }
  function xr(e, t, r) {
    var l = e.updateQueue;
    if (l === null) return null;
    if (((l = l.shared), (Le & 2) !== 0)) {
      var u = l.pending;
      return (
        u === null ? (t.next = t) : ((t.next = u.next), (u.next = t)),
        (l.pending = t),
        (t = fo(e)),
        qh(e, null, r),
        t
      );
    }
    return (co(e, l, t, r), fo(e));
  }
  function Wi(e, t, r) {
    if (
      ((t = t.updateQueue), t !== null && ((t = t.shared), (r & 4194048) !== 0))
    ) {
      var l = t.lanes;
      ((l &= e.pendingLanes), (r |= l), (t.lanes = r), Nt(e, r));
    }
  }
  function Ju(e, t) {
    var r = e.updateQueue,
      l = e.alternate;
    if (l !== null && ((l = l.updateQueue), r === l)) {
      var u = null,
        f = null;
      if (((r = r.firstBaseUpdate), r !== null)) {
        do {
          var y = {
            lane: r.lane,
            tag: r.tag,
            payload: r.payload,
            callback: null,
            next: null,
          };
          (f === null ? (u = f = y) : (f = f.next = y), (r = r.next));
        } while (r !== null);
        f === null ? (u = f = t) : (f = f.next = t);
      } else u = f = t;
      ((r = {
        baseState: l.baseState,
        firstBaseUpdate: u,
        lastBaseUpdate: f,
        shared: l.shared,
        callbacks: l.callbacks,
      }),
        (e.updateQueue = r));
      return;
    }
    ((e = r.lastBaseUpdate),
      e === null ? (r.firstBaseUpdate = t) : (e.next = t),
      (r.lastBaseUpdate = t));
  }
  var Wu = !1;
  function el() {
    if (Wu) {
      var e = Wa;
      if (e !== null) throw e;
    }
  }
  function tl(e, t, r, l) {
    Wu = !1;
    var u = e.updateQueue;
    gr = !1;
    var f = u.firstBaseUpdate,
      y = u.lastBaseUpdate,
      x = u.shared.pending;
    if (x !== null) {
      u.shared.pending = null;
      var _ = x,
        H = _.next;
      ((_.next = null), y === null ? (f = H) : (y.next = H), (y = _));
      var X = e.alternate;
      X !== null &&
        ((X = X.updateQueue),
        (x = X.lastBaseUpdate),
        x !== y &&
          (x === null ? (X.firstBaseUpdate = H) : (x.next = H),
          (X.lastBaseUpdate = _)));
    }
    if (f !== null) {
      var $ = u.baseState;
      ((y = 0), (X = H = _ = null), (x = f));
      do {
        var P = x.lane & -536870913,
          Y = P !== x.lane;
        if (Y ? (Me & P) === P : (l & P) === P) {
          (P !== 0 && P === Ja && (Wu = !0),
            X !== null &&
              (X = X.next =
                {
                  lane: 0,
                  tag: x.tag,
                  payload: x.payload,
                  callback: null,
                  next: null,
                }));
          e: {
            var he = e,
              be = x;
            P = t;
            var ke = r;
            switch (be.tag) {
              case 1:
                if (((he = be.payload), typeof he == "function")) {
                  $ = he.call(ke, $, P);
                  break e;
                }
                $ = he;
                break e;
              case 3:
                he.flags = (he.flags & -65537) | 128;
              case 0:
                if (
                  ((he = be.payload),
                  (P = typeof he == "function" ? he.call(ke, $, P) : he),
                  P == null)
                )
                  break e;
                $ = v({}, $, P);
                break e;
              case 2:
                gr = !0;
            }
          }
          ((P = x.callback),
            P !== null &&
              ((e.flags |= 64),
              Y && (e.flags |= 8192),
              (Y = u.callbacks),
              Y === null ? (u.callbacks = [P]) : Y.push(P)));
        } else
          ((Y = {
            lane: P,
            tag: x.tag,
            payload: x.payload,
            callback: x.callback,
            next: null,
          }),
            X === null ? ((H = X = Y), (_ = $)) : (X = X.next = Y),
            (y |= P));
        if (((x = x.next), x === null)) {
          if (((x = u.shared.pending), x === null)) break;
          ((Y = x),
            (x = Y.next),
            (Y.next = null),
            (u.lastBaseUpdate = Y),
            (u.shared.pending = null));
        }
      } while (!0);
      (X === null && (_ = $),
        (u.baseState = _),
        (u.firstBaseUpdate = H),
        (u.lastBaseUpdate = X),
        f === null && (u.shared.lanes = 0),
        (Cr |= y),
        (e.lanes = y),
        (e.memoizedState = $));
    }
  }
  function rm(e, t) {
    if (typeof e != "function") throw Error(o(191, e));
    e.call(t);
  }
  function am(e, t) {
    var r = e.callbacks;
    if (r !== null)
      for (e.callbacks = null, e = 0; e < r.length; e++) rm(r[e], t);
  }
  var ni = T(null),
    wo = T(0);
  function im(e, t) {
    ((e = Wn), k(wo, e), k(ni, t), (Wn = e | t.baseLanes));
  }
  function ec() {
    (k(wo, Wn), k(ni, ni.current));
  }
  function tc() {
    ((Wn = wo.current), G(ni), G(wo));
  }
  var Yt = T(null),
    ln = null;
  function Sr(e) {
    var t = e.alternate;
    (k(tt, tt.current & 1),
      k(Yt, e),
      ln === null &&
        (t === null || ni.current !== null || t.memoizedState !== null) &&
        (ln = e));
  }
  function nc(e) {
    (k(tt, tt.current), k(Yt, e), ln === null && (ln = e));
  }
  function lm(e) {
    e.tag === 22
      ? (k(tt, tt.current), k(Yt, e), ln === null && (ln = e))
      : wr();
  }
  function wr() {
    (k(tt, tt.current), k(Yt, Yt.current));
  }
  function Gt(e) {
    (G(Yt), ln === e && (ln = null), G(tt));
  }
  var tt = T(0);
  function Eo(e) {
    for (var t = e; t !== null; ) {
      if (t.tag === 13) {
        var r = t.memoizedState;
        if (r !== null && ((r = r.dehydrated), r === null || uf(r) || cf(r)))
          return t;
      } else if (
        t.tag === 19 &&
        (t.memoizedProps.revealOrder === "forwards" ||
          t.memoizedProps.revealOrder === "backwards" ||
          t.memoizedProps.revealOrder === "unstable_legacy-backwards" ||
          t.memoizedProps.revealOrder === "together")
      ) {
        if ((t.flags & 128) !== 0) return t;
      } else if (t.child !== null) {
        ((t.child.return = t), (t = t.child));
        continue;
      }
      if (t === e) break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e) return null;
        t = t.return;
      }
      ((t.sibling.return = t.return), (t = t.sibling));
    }
    return null;
  }
  var Gn = 0,
    we = null,
    qe = null,
    it = null,
    Oo = !1,
    ri = !1,
    ma = !1,
    Co = 0,
    nl = 0,
    ai = null,
    mS = 0;
  function Fe() {
    throw Error(o(321));
  }
  function rc(e, t) {
    if (t === null) return !1;
    for (var r = 0; r < t.length && r < e.length; r++)
      if (!Qt(e[r], t[r])) return !1;
    return !0;
  }
  function ac(e, t, r, l, u, f) {
    return (
      (Gn = f),
      (we = t),
      (t.memoizedState = null),
      (t.updateQueue = null),
      (t.lanes = 0),
      (A.H = e === null || e.memoizedState === null ? Vm : bc),
      (ma = !1),
      (f = r(l, u)),
      (ma = !1),
      ri && (f = sm(t, r, l, u)),
      om(e),
      f
    );
  }
  function om(e) {
    A.H = il;
    var t = qe !== null && qe.next !== null;
    if (((Gn = 0), (it = qe = we = null), (Oo = !1), (nl = 0), (ai = null), t))
      throw Error(o(300));
    e === null ||
      lt ||
      ((e = e.dependencies), e !== null && po(e) && (lt = !0));
  }
  function sm(e, t, r, l) {
    we = e;
    var u = 0;
    do {
      if ((ri && (ai = null), (nl = 0), (ri = !1), 25 <= u))
        throw Error(o(301));
      if (((u += 1), (it = qe = null), e.updateQueue != null)) {
        var f = e.updateQueue;
        ((f.lastEffect = null),
          (f.events = null),
          (f.stores = null),
          f.memoCache != null && (f.memoCache.index = 0));
      }
      ((A.H = Ym), (f = t(r, l)));
    } while (ri);
    return f;
  }
  function pS() {
    var e = A.H,
      t = e.useState()[0];
    return (
      (t = typeof t.then == "function" ? rl(t) : t),
      (e = e.useState()[0]),
      (qe !== null ? qe.memoizedState : null) !== e && (we.flags |= 1024),
      t
    );
  }
  function ic() {
    var e = Co !== 0;
    return ((Co = 0), e);
  }
  function lc(e, t, r) {
    ((t.updateQueue = e.updateQueue), (t.flags &= -2053), (e.lanes &= ~r));
  }
  function oc(e) {
    if (Oo) {
      for (e = e.memoizedState; e !== null; ) {
        var t = e.queue;
        (t !== null && (t.pending = null), (e = e.next));
      }
      Oo = !1;
    }
    ((Gn = 0), (it = qe = we = null), (ri = !1), (nl = Co = 0), (ai = null));
  }
  function At() {
    var e = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null,
    };
    return (it === null ? (we.memoizedState = it = e) : (it = it.next = e), it);
  }
  function nt() {
    if (qe === null) {
      var e = we.alternate;
      e = e !== null ? e.memoizedState : null;
    } else e = qe.next;
    var t = it === null ? we.memoizedState : it.next;
    if (t !== null) ((it = t), (qe = e));
    else {
      if (e === null)
        throw we.alternate === null ? Error(o(467)) : Error(o(310));
      ((qe = e),
        (e = {
          memoizedState: qe.memoizedState,
          baseState: qe.baseState,
          baseQueue: qe.baseQueue,
          queue: qe.queue,
          next: null,
        }),
        it === null ? (we.memoizedState = it = e) : (it = it.next = e));
    }
    return it;
  }
  function To() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function rl(e) {
    var t = nl;
    return (
      (nl += 1),
      ai === null && (ai = []),
      (e = Jh(ai, e, t)),
      (t = we),
      (it === null ? t.memoizedState : it.next) === null &&
        ((t = t.alternate),
        (A.H = t === null || t.memoizedState === null ? Vm : bc)),
      e
    );
  }
  function _o(e) {
    if (e !== null && typeof e == "object") {
      if (typeof e.then == "function") return rl(e);
      if (e.$$typeof === q) return vt(e);
    }
    throw Error(o(438, String(e)));
  }
  function sc(e) {
    var t = null,
      r = we.updateQueue;
    if ((r !== null && (t = r.memoCache), t == null)) {
      var l = we.alternate;
      l !== null &&
        ((l = l.updateQueue),
        l !== null &&
          ((l = l.memoCache),
          l != null &&
            (t = {
              data: l.data.map(function (u) {
                return u.slice();
              }),
              index: 0,
            })));
    }
    if (
      (t == null && (t = { data: [], index: 0 }),
      r === null && ((r = To()), (we.updateQueue = r)),
      (r.memoCache = t),
      (r = t.data[t.index]),
      r === void 0)
    )
      for (r = t.data[t.index] = Array(e), l = 0; l < e; l++) r[l] = ne;
    return (t.index++, r);
  }
  function Kn(e, t) {
    return typeof t == "function" ? t(e) : t;
  }
  function Ao(e) {
    var t = nt();
    return uc(t, qe, e);
  }
  function uc(e, t, r) {
    var l = e.queue;
    if (l === null) throw Error(o(311));
    l.lastRenderedReducer = r;
    var u = e.baseQueue,
      f = l.pending;
    if (f !== null) {
      if (u !== null) {
        var y = u.next;
        ((u.next = f.next), (f.next = y));
      }
      ((t.baseQueue = u = f), (l.pending = null));
    }
    if (((f = e.baseState), u === null)) e.memoizedState = f;
    else {
      t = u.next;
      var x = (y = null),
        _ = null,
        H = t,
        X = !1;
      do {
        var $ = H.lane & -536870913;
        if ($ !== H.lane ? (Me & $) === $ : (Gn & $) === $) {
          var P = H.revertLane;
          if (P === 0)
            (_ !== null &&
              (_ = _.next =
                {
                  lane: 0,
                  revertLane: 0,
                  gesture: null,
                  action: H.action,
                  hasEagerState: H.hasEagerState,
                  eagerState: H.eagerState,
                  next: null,
                }),
              $ === Ja && (X = !0));
          else if ((Gn & P) === P) {
            ((H = H.next), P === Ja && (X = !0));
            continue;
          } else
            (($ = {
              lane: 0,
              revertLane: H.revertLane,
              gesture: null,
              action: H.action,
              hasEagerState: H.hasEagerState,
              eagerState: H.eagerState,
              next: null,
            }),
              _ === null ? ((x = _ = $), (y = f)) : (_ = _.next = $),
              (we.lanes |= P),
              (Cr |= P));
          (($ = H.action),
            ma && r(f, $),
            (f = H.hasEagerState ? H.eagerState : r(f, $)));
        } else
          ((P = {
            lane: $,
            revertLane: H.revertLane,
            gesture: H.gesture,
            action: H.action,
            hasEagerState: H.hasEagerState,
            eagerState: H.eagerState,
            next: null,
          }),
            _ === null ? ((x = _ = P), (y = f)) : (_ = _.next = P),
            (we.lanes |= $),
            (Cr |= $));
        H = H.next;
      } while (H !== null && H !== t);
      if (
        (_ === null ? (y = f) : (_.next = x),
        !Qt(f, e.memoizedState) && ((lt = !0), X && ((r = Wa), r !== null)))
      )
        throw r;
      ((e.memoizedState = f),
        (e.baseState = y),
        (e.baseQueue = _),
        (l.lastRenderedState = f));
    }
    return (u === null && (l.lanes = 0), [e.memoizedState, l.dispatch]);
  }
  function cc(e) {
    var t = nt(),
      r = t.queue;
    if (r === null) throw Error(o(311));
    r.lastRenderedReducer = e;
    var l = r.dispatch,
      u = r.pending,
      f = t.memoizedState;
    if (u !== null) {
      r.pending = null;
      var y = (u = u.next);
      do ((f = e(f, y.action)), (y = y.next));
      while (y !== u);
      (Qt(f, t.memoizedState) || (lt = !0),
        (t.memoizedState = f),
        t.baseQueue === null && (t.baseState = f),
        (r.lastRenderedState = f));
    }
    return [f, l];
  }
  function um(e, t, r) {
    var l = we,
      u = nt(),
      f = De;
    if (f) {
      if (r === void 0) throw Error(o(407));
      r = r();
    } else r = t();
    var y = !Qt((qe || u).memoizedState, r);
    if (
      (y && ((u.memoizedState = r), (lt = !0)),
      (u = u.queue),
      hc(dm.bind(null, l, u, e), [e]),
      u.getSnapshot !== t || y || (it !== null && it.memoizedState.tag & 1))
    ) {
      if (
        ((l.flags |= 2048),
        ii(9, { destroy: void 0 }, fm.bind(null, l, u, r, t), null),
        Qe === null)
      )
        throw Error(o(349));
      f || (Gn & 127) !== 0 || cm(l, t, r);
    }
    return r;
  }
  function cm(e, t, r) {
    ((e.flags |= 16384),
      (e = { getSnapshot: t, value: r }),
      (t = we.updateQueue),
      t === null
        ? ((t = To()), (we.updateQueue = t), (t.stores = [e]))
        : ((r = t.stores), r === null ? (t.stores = [e]) : r.push(e)));
  }
  function fm(e, t, r, l) {
    ((t.value = r), (t.getSnapshot = l), hm(t) && mm(e));
  }
  function dm(e, t, r) {
    return r(function () {
      hm(t) && mm(e);
    });
  }
  function hm(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
      var r = t();
      return !Qt(e, r);
    } catch {
      return !0;
    }
  }
  function mm(e) {
    var t = ia(e, 2);
    t !== null && qt(t, e, 2);
  }
  function fc(e) {
    var t = At();
    if (typeof e == "function") {
      var r = e;
      if (((e = r()), ma)) {
        fn(!0);
        try {
          r();
        } finally {
          fn(!1);
        }
      }
    }
    return (
      (t.memoizedState = t.baseState = e),
      (t.queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Kn,
        lastRenderedState: e,
      }),
      t
    );
  }
  function pm(e, t, r, l) {
    return ((e.baseState = r), uc(e, qe, typeof l == "function" ? l : Kn));
  }
  function vS(e, t, r, l, u) {
    if (No(e)) throw Error(o(485));
    if (((e = t.action), e !== null)) {
      var f = {
        payload: u,
        action: e,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function (y) {
          f.listeners.push(y);
        },
      };
      (A.T !== null ? r(!0) : (f.isTransition = !1),
        l(f),
        (r = t.pending),
        r === null
          ? ((f.next = t.pending = f), vm(t, f))
          : ((f.next = r.next), (t.pending = r.next = f)));
    }
  }
  function vm(e, t) {
    var r = t.action,
      l = t.payload,
      u = e.state;
    if (t.isTransition) {
      var f = A.T,
        y = {};
      A.T = y;
      try {
        var x = r(u, l),
          _ = A.S;
        (_ !== null && _(y, x), ym(e, t, x));
      } catch (H) {
        dc(e, t, H);
      } finally {
        (f !== null && y.types !== null && (f.types = y.types), (A.T = f));
      }
    } else
      try {
        ((f = r(u, l)), ym(e, t, f));
      } catch (H) {
        dc(e, t, H);
      }
  }
  function ym(e, t, r) {
    r !== null && typeof r == "object" && typeof r.then == "function"
      ? r.then(
          function (l) {
            gm(e, t, l);
          },
          function (l) {
            return dc(e, t, l);
          },
        )
      : gm(e, t, r);
  }
  function gm(e, t, r) {
    ((t.status = "fulfilled"),
      (t.value = r),
      bm(t),
      (e.state = r),
      (t = e.pending),
      t !== null &&
        ((r = t.next),
        r === t ? (e.pending = null) : ((r = r.next), (t.next = r), vm(e, r))));
  }
  function dc(e, t, r) {
    var l = e.pending;
    if (((e.pending = null), l !== null)) {
      l = l.next;
      do ((t.status = "rejected"), (t.reason = r), bm(t), (t = t.next));
      while (t !== l);
    }
    e.action = null;
  }
  function bm(e) {
    e = e.listeners;
    for (var t = 0; t < e.length; t++) (0, e[t])();
  }
  function xm(e, t) {
    return t;
  }
  function Sm(e, t) {
    if (De) {
      var r = Qe.formState;
      if (r !== null) {
        e: {
          var l = we;
          if (De) {
            if (Ye) {
              t: {
                for (var u = Ye, f = an; u.nodeType !== 8; ) {
                  if (!f) {
                    u = null;
                    break t;
                  }
                  if (((u = on(u.nextSibling)), u === null)) {
                    u = null;
                    break t;
                  }
                }
                ((f = u.data), (u = f === "F!" || f === "F" ? u : null));
              }
              if (u) {
                ((Ye = on(u.nextSibling)), (l = u.data === "F!"));
                break e;
              }
            }
            vr(l);
          }
          l = !1;
        }
        l && (t = r[0]);
      }
    }
    return (
      (r = At()),
      (r.memoizedState = r.baseState = t),
      (l = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: xm,
        lastRenderedState: t,
      }),
      (r.queue = l),
      (r = Pm.bind(null, we, l)),
      (l.dispatch = r),
      (l = fc(!1)),
      (f = gc.bind(null, we, !1, l.queue)),
      (l = At()),
      (u = { state: t, dispatch: null, action: e, pending: null }),
      (l.queue = u),
      (r = vS.bind(null, we, u, f, r)),
      (u.dispatch = r),
      (l.memoizedState = e),
      [t, r, !1]
    );
  }
  function wm(e) {
    var t = nt();
    return Em(t, qe, e);
  }
  function Em(e, t, r) {
    if (
      ((t = uc(e, t, xm)[0]),
      (e = Ao(Kn)[0]),
      typeof t == "object" && t !== null && typeof t.then == "function")
    )
      try {
        var l = rl(t);
      } catch (y) {
        throw y === ei ? go : y;
      }
    else l = t;
    t = nt();
    var u = t.queue,
      f = u.dispatch;
    return (
      r !== t.memoizedState &&
        ((we.flags |= 2048),
        ii(9, { destroy: void 0 }, yS.bind(null, u, r), null)),
      [l, f, e]
    );
  }
  function yS(e, t) {
    e.action = t;
  }
  function Om(e) {
    var t = nt(),
      r = qe;
    if (r !== null) return Em(t, r, e);
    (nt(), (t = t.memoizedState), (r = nt()));
    var l = r.queue.dispatch;
    return ((r.memoizedState = e), [t, l, !1]);
  }
  function ii(e, t, r, l) {
    return (
      (e = { tag: e, create: r, deps: l, inst: t, next: null }),
      (t = we.updateQueue),
      t === null && ((t = To()), (we.updateQueue = t)),
      (r = t.lastEffect),
      r === null
        ? (t.lastEffect = e.next = e)
        : ((l = r.next), (r.next = e), (e.next = l), (t.lastEffect = e)),
      e
    );
  }
  function Cm() {
    return nt().memoizedState;
  }
  function Ro(e, t, r, l) {
    var u = At();
    ((we.flags |= e),
      (u.memoizedState = ii(
        1 | t,
        { destroy: void 0 },
        r,
        l === void 0 ? null : l,
      )));
  }
  function Mo(e, t, r, l) {
    var u = nt();
    l = l === void 0 ? null : l;
    var f = u.memoizedState.inst;
    qe !== null && l !== null && rc(l, qe.memoizedState.deps)
      ? (u.memoizedState = ii(t, f, r, l))
      : ((we.flags |= e), (u.memoizedState = ii(1 | t, f, r, l)));
  }
  function Tm(e, t) {
    Ro(8390656, 8, e, t);
  }
  function hc(e, t) {
    Mo(2048, 8, e, t);
  }
  function gS(e) {
    we.flags |= 4;
    var t = we.updateQueue;
    if (t === null) ((t = To()), (we.updateQueue = t), (t.events = [e]));
    else {
      var r = t.events;
      r === null ? (t.events = [e]) : r.push(e);
    }
  }
  function _m(e) {
    var t = nt().memoizedState;
    return (
      gS({ ref: t, nextImpl: e }),
      function () {
        if ((Le & 2) !== 0) throw Error(o(440));
        return t.impl.apply(void 0, arguments);
      }
    );
  }
  function Am(e, t) {
    return Mo(4, 2, e, t);
  }
  function Rm(e, t) {
    return Mo(4, 4, e, t);
  }
  function Mm(e, t) {
    if (typeof t == "function") {
      e = e();
      var r = t(e);
      return function () {
        typeof r == "function" ? r() : t(null);
      };
    }
    if (t != null)
      return (
        (e = e()),
        (t.current = e),
        function () {
          t.current = null;
        }
      );
  }
  function Nm(e, t, r) {
    ((r = r != null ? r.concat([e]) : null), Mo(4, 4, Mm.bind(null, t, e), r));
  }
  function mc() {}
  function Dm(e, t) {
    var r = nt();
    t = t === void 0 ? null : t;
    var l = r.memoizedState;
    return t !== null && rc(t, l[1]) ? l[0] : ((r.memoizedState = [e, t]), e);
  }
  function jm(e, t) {
    var r = nt();
    t = t === void 0 ? null : t;
    var l = r.memoizedState;
    if (t !== null && rc(t, l[1])) return l[0];
    if (((l = e()), ma)) {
      fn(!0);
      try {
        e();
      } finally {
        fn(!1);
      }
    }
    return ((r.memoizedState = [l, t]), l);
  }
  function pc(e, t, r) {
    return r === void 0 || ((Gn & 1073741824) !== 0 && (Me & 261930) === 0)
      ? (e.memoizedState = t)
      : ((e.memoizedState = r), (e = zp()), (we.lanes |= e), (Cr |= e), r);
  }
  function zm(e, t, r, l) {
    return Qt(r, t)
      ? r
      : ni.current !== null
        ? ((e = pc(e, r, l)), Qt(e, t) || (lt = !0), e)
        : (Gn & 42) === 0 || ((Gn & 1073741824) !== 0 && (Me & 261930) === 0)
          ? ((lt = !0), (e.memoizedState = r))
          : ((e = zp()), (we.lanes |= e), (Cr |= e), t);
  }
  function Um(e, t, r, l, u) {
    var f = B.p;
    B.p = f !== 0 && 8 > f ? f : 8;
    var y = A.T,
      x = {};
    ((A.T = x), gc(e, !1, t, r));
    try {
      var _ = u(),
        H = A.S;
      if (
        (H !== null && H(x, _),
        _ !== null && typeof _ == "object" && typeof _.then == "function")
      ) {
        var X = hS(_, l);
        al(e, t, X, It(e));
      } else al(e, t, l, It(e));
    } catch ($) {
      al(e, t, { then: function () {}, status: "rejected", reason: $ }, It());
    } finally {
      ((B.p = f),
        y !== null && x.types !== null && (y.types = x.types),
        (A.T = y));
    }
  }
  function bS() {}
  function vc(e, t, r, l) {
    if (e.tag !== 5) throw Error(o(476));
    var u = Lm(e).queue;
    Um(
      e,
      u,
      t,
      K,
      r === null
        ? bS
        : function () {
            return (Hm(e), r(l));
          },
    );
  }
  function Lm(e) {
    var t = e.memoizedState;
    if (t !== null) return t;
    t = {
      memoizedState: K,
      baseState: K,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Kn,
        lastRenderedState: K,
      },
      next: null,
    };
    var r = {};
    return (
      (t.next = {
        memoizedState: r,
        baseState: r,
        baseQueue: null,
        queue: {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: Kn,
          lastRenderedState: r,
        },
        next: null,
      }),
      (e.memoizedState = t),
      (e = e.alternate),
      e !== null && (e.memoizedState = t),
      t
    );
  }
  function Hm(e) {
    var t = Lm(e);
    (t.next === null && (t = e.alternate.memoizedState),
      al(e, t.next.queue, {}, It()));
  }
  function yc() {
    return vt(Sl);
  }
  function Bm() {
    return nt().memoizedState;
  }
  function qm() {
    return nt().memoizedState;
  }
  function xS(e) {
    for (var t = e.return; t !== null; ) {
      switch (t.tag) {
        case 24:
        case 3:
          var r = It();
          e = br(r);
          var l = xr(t, e, r);
          (l !== null && (qt(l, t, r), Wi(l, t, r)),
            (t = { cache: Ku() }),
            (e.payload = t));
          return;
      }
      t = t.return;
    }
  }
  function SS(e, t, r) {
    var l = It();
    ((r = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: r,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    }),
      No(e)
        ? km(t, r)
        : ((r = Uu(e, t, r, l)), r !== null && (qt(r, e, l), Qm(r, t, l))));
  }
  function Pm(e, t, r) {
    var l = It();
    al(e, t, r, l);
  }
  function al(e, t, r, l) {
    var u = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: r,
      hasEagerState: !1,
      eagerState: null,
      next: null,
    };
    if (No(e)) km(t, u);
    else {
      var f = e.alternate;
      if (
        e.lanes === 0 &&
        (f === null || f.lanes === 0) &&
        ((f = t.lastRenderedReducer), f !== null)
      )
        try {
          var y = t.lastRenderedState,
            x = f(y, r);
          if (((u.hasEagerState = !0), (u.eagerState = x), Qt(x, y)))
            return (co(e, t, u, 0), Qe === null && uo(), !1);
        } catch {}
      if (((r = Uu(e, t, u, l)), r !== null))
        return (qt(r, e, l), Qm(r, t, l), !0);
    }
    return !1;
  }
  function gc(e, t, r, l) {
    if (
      ((l = {
        lane: 2,
        revertLane: Fc(),
        gesture: null,
        action: l,
        hasEagerState: !1,
        eagerState: null,
        next: null,
      }),
      No(e))
    ) {
      if (t) throw Error(o(479));
    } else ((t = Uu(e, r, l, 2)), t !== null && qt(t, e, 2));
  }
  function No(e) {
    var t = e.alternate;
    return e === we || (t !== null && t === we);
  }
  function km(e, t) {
    ri = Oo = !0;
    var r = e.pending;
    (r === null ? (t.next = t) : ((t.next = r.next), (r.next = t)),
      (e.pending = t));
  }
  function Qm(e, t, r) {
    if ((r & 4194048) !== 0) {
      var l = t.lanes;
      ((l &= e.pendingLanes), (r |= l), (t.lanes = r), Nt(e, r));
    }
  }
  var il = {
    readContext: vt,
    use: _o,
    useCallback: Fe,
    useContext: Fe,
    useEffect: Fe,
    useImperativeHandle: Fe,
    useLayoutEffect: Fe,
    useInsertionEffect: Fe,
    useMemo: Fe,
    useReducer: Fe,
    useRef: Fe,
    useState: Fe,
    useDebugValue: Fe,
    useDeferredValue: Fe,
    useTransition: Fe,
    useSyncExternalStore: Fe,
    useId: Fe,
    useHostTransitionStatus: Fe,
    useFormState: Fe,
    useActionState: Fe,
    useOptimistic: Fe,
    useMemoCache: Fe,
    useCacheRefresh: Fe,
  };
  il.useEffectEvent = Fe;
  var Vm = {
      readContext: vt,
      use: _o,
      useCallback: function (e, t) {
        return ((At().memoizedState = [e, t === void 0 ? null : t]), e);
      },
      useContext: vt,
      useEffect: Tm,
      useImperativeHandle: function (e, t, r) {
        ((r = r != null ? r.concat([e]) : null),
          Ro(4194308, 4, Mm.bind(null, t, e), r));
      },
      useLayoutEffect: function (e, t) {
        return Ro(4194308, 4, e, t);
      },
      useInsertionEffect: function (e, t) {
        Ro(4, 2, e, t);
      },
      useMemo: function (e, t) {
        var r = At();
        t = t === void 0 ? null : t;
        var l = e();
        if (ma) {
          fn(!0);
          try {
            e();
          } finally {
            fn(!1);
          }
        }
        return ((r.memoizedState = [l, t]), l);
      },
      useReducer: function (e, t, r) {
        var l = At();
        if (r !== void 0) {
          var u = r(t);
          if (ma) {
            fn(!0);
            try {
              r(t);
            } finally {
              fn(!1);
            }
          }
        } else u = t;
        return (
          (l.memoizedState = l.baseState = u),
          (e = {
            pending: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: e,
            lastRenderedState: u,
          }),
          (l.queue = e),
          (e = e.dispatch = SS.bind(null, we, e)),
          [l.memoizedState, e]
        );
      },
      useRef: function (e) {
        var t = At();
        return ((e = { current: e }), (t.memoizedState = e));
      },
      useState: function (e) {
        e = fc(e);
        var t = e.queue,
          r = Pm.bind(null, we, t);
        return ((t.dispatch = r), [e.memoizedState, r]);
      },
      useDebugValue: mc,
      useDeferredValue: function (e, t) {
        var r = At();
        return pc(r, e, t);
      },
      useTransition: function () {
        var e = fc(!1);
        return (
          (e = Um.bind(null, we, e.queue, !0, !1)),
          (At().memoizedState = e),
          [!1, e]
        );
      },
      useSyncExternalStore: function (e, t, r) {
        var l = we,
          u = At();
        if (De) {
          if (r === void 0) throw Error(o(407));
          r = r();
        } else {
          if (((r = t()), Qe === null)) throw Error(o(349));
          (Me & 127) !== 0 || cm(l, t, r);
        }
        u.memoizedState = r;
        var f = { value: r, getSnapshot: t };
        return (
          (u.queue = f),
          Tm(dm.bind(null, l, f, e), [e]),
          (l.flags |= 2048),
          ii(9, { destroy: void 0 }, fm.bind(null, l, f, r, t), null),
          r
        );
      },
      useId: function () {
        var e = At(),
          t = Qe.identifierPrefix;
        if (De) {
          var r = Cn,
            l = On;
          ((r = (l & ~(1 << (32 - bt(l) - 1))).toString(32) + r),
            (t = "_" + t + "R_" + r),
            (r = Co++),
            0 < r && (t += "H" + r.toString(32)),
            (t += "_"));
        } else ((r = mS++), (t = "_" + t + "r_" + r.toString(32) + "_"));
        return (e.memoizedState = t);
      },
      useHostTransitionStatus: yc,
      useFormState: Sm,
      useActionState: Sm,
      useOptimistic: function (e) {
        var t = At();
        t.memoizedState = t.baseState = e;
        var r = {
          pending: null,
          lanes: 0,
          dispatch: null,
          lastRenderedReducer: null,
          lastRenderedState: null,
        };
        return (
          (t.queue = r),
          (t = gc.bind(null, we, !0, r)),
          (r.dispatch = t),
          [e, t]
        );
      },
      useMemoCache: sc,
      useCacheRefresh: function () {
        return (At().memoizedState = xS.bind(null, we));
      },
      useEffectEvent: function (e) {
        var t = At(),
          r = { impl: e };
        return (
          (t.memoizedState = r),
          function () {
            if ((Le & 2) !== 0) throw Error(o(440));
            return r.impl.apply(void 0, arguments);
          }
        );
      },
    },
    bc = {
      readContext: vt,
      use: _o,
      useCallback: Dm,
      useContext: vt,
      useEffect: hc,
      useImperativeHandle: Nm,
      useInsertionEffect: Am,
      useLayoutEffect: Rm,
      useMemo: jm,
      useReducer: Ao,
      useRef: Cm,
      useState: function () {
        return Ao(Kn);
      },
      useDebugValue: mc,
      useDeferredValue: function (e, t) {
        var r = nt();
        return zm(r, qe.memoizedState, e, t);
      },
      useTransition: function () {
        var e = Ao(Kn)[0],
          t = nt().memoizedState;
        return [typeof e == "boolean" ? e : rl(e), t];
      },
      useSyncExternalStore: um,
      useId: Bm,
      useHostTransitionStatus: yc,
      useFormState: wm,
      useActionState: wm,
      useOptimistic: function (e, t) {
        var r = nt();
        return pm(r, qe, e, t);
      },
      useMemoCache: sc,
      useCacheRefresh: qm,
    };
  bc.useEffectEvent = _m;
  var Ym = {
    readContext: vt,
    use: _o,
    useCallback: Dm,
    useContext: vt,
    useEffect: hc,
    useImperativeHandle: Nm,
    useInsertionEffect: Am,
    useLayoutEffect: Rm,
    useMemo: jm,
    useReducer: cc,
    useRef: Cm,
    useState: function () {
      return cc(Kn);
    },
    useDebugValue: mc,
    useDeferredValue: function (e, t) {
      var r = nt();
      return qe === null ? pc(r, e, t) : zm(r, qe.memoizedState, e, t);
    },
    useTransition: function () {
      var e = cc(Kn)[0],
        t = nt().memoizedState;
      return [typeof e == "boolean" ? e : rl(e), t];
    },
    useSyncExternalStore: um,
    useId: Bm,
    useHostTransitionStatus: yc,
    useFormState: Om,
    useActionState: Om,
    useOptimistic: function (e, t) {
      var r = nt();
      return qe !== null
        ? pm(r, qe, e, t)
        : ((r.baseState = e), [e, r.queue.dispatch]);
    },
    useMemoCache: sc,
    useCacheRefresh: qm,
  };
  Ym.useEffectEvent = _m;
  function xc(e, t, r, l) {
    ((t = e.memoizedState),
      (r = r(l, t)),
      (r = r == null ? t : v({}, t, r)),
      (e.memoizedState = r),
      e.lanes === 0 && (e.updateQueue.baseState = r));
  }
  var Sc = {
    enqueueSetState: function (e, t, r) {
      e = e._reactInternals;
      var l = It(),
        u = br(l);
      ((u.payload = t),
        r != null && (u.callback = r),
        (t = xr(e, u, l)),
        t !== null && (qt(t, e, l), Wi(t, e, l)));
    },
    enqueueReplaceState: function (e, t, r) {
      e = e._reactInternals;
      var l = It(),
        u = br(l);
      ((u.tag = 1),
        (u.payload = t),
        r != null && (u.callback = r),
        (t = xr(e, u, l)),
        t !== null && (qt(t, e, l), Wi(t, e, l)));
    },
    enqueueForceUpdate: function (e, t) {
      e = e._reactInternals;
      var r = It(),
        l = br(r);
      ((l.tag = 2),
        t != null && (l.callback = t),
        (t = xr(e, l, r)),
        t !== null && (qt(t, e, r), Wi(t, e, r)));
    },
  };
  function Gm(e, t, r, l, u, f, y) {
    return (
      (e = e.stateNode),
      typeof e.shouldComponentUpdate == "function"
        ? e.shouldComponentUpdate(l, f, y)
        : t.prototype && t.prototype.isPureReactComponent
          ? !Gi(r, l) || !Gi(u, f)
          : !0
    );
  }
  function Km(e, t, r, l) {
    ((e = t.state),
      typeof t.componentWillReceiveProps == "function" &&
        t.componentWillReceiveProps(r, l),
      typeof t.UNSAFE_componentWillReceiveProps == "function" &&
        t.UNSAFE_componentWillReceiveProps(r, l),
      t.state !== e && Sc.enqueueReplaceState(t, t.state, null));
  }
  function pa(e, t) {
    var r = t;
    if ("ref" in t) {
      r = {};
      for (var l in t) l !== "ref" && (r[l] = t[l]);
    }
    if ((e = e.defaultProps)) {
      r === t && (r = v({}, r));
      for (var u in e) r[u] === void 0 && (r[u] = e[u]);
    }
    return r;
  }
  function Xm(e) {
    so(e);
  }
  function Im(e) {
    console.error(e);
  }
  function Zm(e) {
    so(e);
  }
  function Do(e, t) {
    try {
      var r = e.onUncaughtError;
      r(t.value, { componentStack: t.stack });
    } catch (l) {
      setTimeout(function () {
        throw l;
      });
    }
  }
  function Fm(e, t, r) {
    try {
      var l = e.onCaughtError;
      l(r.value, {
        componentStack: r.stack,
        errorBoundary: t.tag === 1 ? t.stateNode : null,
      });
    } catch (u) {
      setTimeout(function () {
        throw u;
      });
    }
  }
  function wc(e, t, r) {
    return (
      (r = br(r)),
      (r.tag = 3),
      (r.payload = { element: null }),
      (r.callback = function () {
        Do(e, t);
      }),
      r
    );
  }
  function $m(e) {
    return ((e = br(e)), (e.tag = 3), e);
  }
  function Jm(e, t, r, l) {
    var u = r.type.getDerivedStateFromError;
    if (typeof u == "function") {
      var f = l.value;
      ((e.payload = function () {
        return u(f);
      }),
        (e.callback = function () {
          Fm(t, r, l);
        }));
    }
    var y = r.stateNode;
    y !== null &&
      typeof y.componentDidCatch == "function" &&
      (e.callback = function () {
        (Fm(t, r, l),
          typeof u != "function" &&
            (Tr === null ? (Tr = new Set([this])) : Tr.add(this)));
        var x = l.stack;
        this.componentDidCatch(l.value, {
          componentStack: x !== null ? x : "",
        });
      });
  }
  function wS(e, t, r, l, u) {
    if (
      ((r.flags |= 32768),
      l !== null && typeof l == "object" && typeof l.then == "function")
    ) {
      if (
        ((t = r.alternate),
        t !== null && $a(t, r, u, !0),
        (r = Yt.current),
        r !== null)
      ) {
        switch (r.tag) {
          case 31:
          case 13:
            return (
              ln === null ? Yo() : r.alternate === null && $e === 0 && ($e = 3),
              (r.flags &= -257),
              (r.flags |= 65536),
              (r.lanes = u),
              l === bo
                ? (r.flags |= 16384)
                : ((t = r.updateQueue),
                  t === null ? (r.updateQueue = new Set([l])) : t.add(l),
                  Xc(e, l, u)),
              !1
            );
          case 22:
            return (
              (r.flags |= 65536),
              l === bo
                ? (r.flags |= 16384)
                : ((t = r.updateQueue),
                  t === null
                    ? ((t = {
                        transitions: null,
                        markerInstances: null,
                        retryQueue: new Set([l]),
                      }),
                      (r.updateQueue = t))
                    : ((r = t.retryQueue),
                      r === null ? (t.retryQueue = new Set([l])) : r.add(l)),
                  Xc(e, l, u)),
              !1
            );
        }
        throw Error(o(435, r.tag));
      }
      return (Xc(e, l, u), Yo(), !1);
    }
    if (De)
      return (
        (t = Yt.current),
        t !== null
          ? ((t.flags & 65536) === 0 && (t.flags |= 256),
            (t.flags |= 65536),
            (t.lanes = u),
            l !== ku && ((e = Error(o(422), { cause: l })), Ii(tn(e, r))))
          : (l !== ku && ((t = Error(o(423), { cause: l })), Ii(tn(t, r))),
            (e = e.current.alternate),
            (e.flags |= 65536),
            (u &= -u),
            (e.lanes |= u),
            (l = tn(l, r)),
            (u = wc(e.stateNode, l, u)),
            Ju(e, u),
            $e !== 4 && ($e = 2)),
        !1
      );
    var f = Error(o(520), { cause: l });
    if (
      ((f = tn(f, r)),
      hl === null ? (hl = [f]) : hl.push(f),
      $e !== 4 && ($e = 2),
      t === null)
    )
      return !0;
    ((l = tn(l, r)), (r = t));
    do {
      switch (r.tag) {
        case 3:
          return (
            (r.flags |= 65536),
            (e = u & -u),
            (r.lanes |= e),
            (e = wc(r.stateNode, l, e)),
            Ju(r, e),
            !1
          );
        case 1:
          if (
            ((t = r.type),
            (f = r.stateNode),
            (r.flags & 128) === 0 &&
              (typeof t.getDerivedStateFromError == "function" ||
                (f !== null &&
                  typeof f.componentDidCatch == "function" &&
                  (Tr === null || !Tr.has(f)))))
          )
            return (
              (r.flags |= 65536),
              (u &= -u),
              (r.lanes |= u),
              (u = $m(u)),
              Jm(u, e, r, l),
              Ju(r, u),
              !1
            );
      }
      r = r.return;
    } while (r !== null);
    return !1;
  }
  var Ec = Error(o(461)),
    lt = !1;
  function yt(e, t, r, l) {
    t.child = e === null ? nm(t, null, r, l) : ha(t, e.child, r, l);
  }
  function Wm(e, t, r, l, u) {
    r = r.render;
    var f = t.ref;
    if ("ref" in l) {
      var y = {};
      for (var x in l) x !== "ref" && (y[x] = l[x]);
    } else y = l;
    return (
      ua(t),
      (l = ac(e, t, r, y, f, u)),
      (x = ic()),
      e !== null && !lt
        ? (lc(e, t, u), Xn(e, t, u))
        : (De && x && qu(t), (t.flags |= 1), yt(e, t, l, u), t.child)
    );
  }
  function ep(e, t, r, l, u) {
    if (e === null) {
      var f = r.type;
      return typeof f == "function" &&
        !Lu(f) &&
        f.defaultProps === void 0 &&
        r.compare === null
        ? ((t.tag = 15), (t.type = f), tp(e, t, f, l, u))
        : ((e = ho(r.type, null, l, t, t.mode, u)),
          (e.ref = t.ref),
          (e.return = t),
          (t.child = e));
    }
    if (((f = e.child), !Nc(e, u))) {
      var y = f.memoizedProps;
      if (
        ((r = r.compare), (r = r !== null ? r : Gi), r(y, l) && e.ref === t.ref)
      )
        return Xn(e, t, u);
    }
    return (
      (t.flags |= 1),
      (e = kn(f, l)),
      (e.ref = t.ref),
      (e.return = t),
      (t.child = e)
    );
  }
  function tp(e, t, r, l, u) {
    if (e !== null) {
      var f = e.memoizedProps;
      if (Gi(f, l) && e.ref === t.ref)
        if (((lt = !1), (t.pendingProps = l = f), Nc(e, u)))
          (e.flags & 131072) !== 0 && (lt = !0);
        else return ((t.lanes = e.lanes), Xn(e, t, u));
    }
    return Oc(e, t, r, l, u);
  }
  function np(e, t, r, l) {
    var u = l.children,
      f = e !== null ? e.memoizedState : null;
    if (
      (e === null &&
        t.stateNode === null &&
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      l.mode === "hidden")
    ) {
      if ((t.flags & 128) !== 0) {
        if (((f = f !== null ? f.baseLanes | r : r), e !== null)) {
          for (l = t.child = e.child, u = 0; l !== null; )
            ((u = u | l.lanes | l.childLanes), (l = l.sibling));
          l = u & ~f;
        } else ((l = 0), (t.child = null));
        return rp(e, t, f, r, l);
      }
      if ((r & 536870912) !== 0)
        ((t.memoizedState = { baseLanes: 0, cachePool: null }),
          e !== null && yo(t, f !== null ? f.cachePool : null),
          f !== null ? im(t, f) : ec(),
          lm(t));
      else
        return (
          (l = t.lanes = 536870912),
          rp(e, t, f !== null ? f.baseLanes | r : r, r, l)
        );
    } else
      f !== null
        ? (yo(t, f.cachePool), im(t, f), wr(), (t.memoizedState = null))
        : (e !== null && yo(t, null), ec(), wr());
    return (yt(e, t, u, r), t.child);
  }
  function ll(e, t) {
    return (
      (e !== null && e.tag === 22) ||
        t.stateNode !== null ||
        (t.stateNode = {
          _visibility: 1,
          _pendingMarkers: null,
          _retryCache: null,
          _transitions: null,
        }),
      t.sibling
    );
  }
  function rp(e, t, r, l, u) {
    var f = Iu();
    return (
      (f = f === null ? null : { parent: at._currentValue, pool: f }),
      (t.memoizedState = { baseLanes: r, cachePool: f }),
      e !== null && yo(t, null),
      ec(),
      lm(t),
      e !== null && $a(e, t, l, !0),
      (t.childLanes = u),
      null
    );
  }
  function jo(e, t) {
    return (
      (t = Uo({ mode: t.mode, children: t.children }, e.mode)),
      (t.ref = e.ref),
      (e.child = t),
      (t.return = e),
      t
    );
  }
  function ap(e, t, r) {
    return (
      ha(t, e.child, null, r),
      (e = jo(t, t.pendingProps)),
      (e.flags |= 2),
      Gt(t),
      (t.memoizedState = null),
      e
    );
  }
  function ES(e, t, r) {
    var l = t.pendingProps,
      u = (t.flags & 128) !== 0;
    if (((t.flags &= -129), e === null)) {
      if (De) {
        if (l.mode === "hidden")
          return ((e = jo(t, l)), (t.lanes = 536870912), ll(null, e));
        if (
          (nc(t),
          (e = Ye)
            ? ((e = vv(e, an)),
              (e = e !== null && e.data === "&" ? e : null),
              e !== null &&
                ((t.memoizedState = {
                  dehydrated: e,
                  treeContext: mr !== null ? { id: On, overflow: Cn } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (r = kh(e)),
                (r.return = t),
                (t.child = r),
                (pt = t),
                (Ye = null)))
            : (e = null),
          e === null)
        )
          throw vr(t);
        return ((t.lanes = 536870912), null);
      }
      return jo(t, l);
    }
    var f = e.memoizedState;
    if (f !== null) {
      var y = f.dehydrated;
      if ((nc(t), u))
        if (t.flags & 256) ((t.flags &= -257), (t = ap(e, t, r)));
        else if (t.memoizedState !== null)
          ((t.child = e.child), (t.flags |= 128), (t = null));
        else throw Error(o(558));
      else if (
        (lt || $a(e, t, r, !1), (u = (r & e.childLanes) !== 0), lt || u)
      ) {
        if (
          ((l = Qe),
          l !== null && ((y = Dt(l, r)), y !== 0 && y !== f.retryLane))
        )
          throw ((f.retryLane = y), ia(e, y), qt(l, e, y), Ec);
        (Yo(), (t = ap(e, t, r)));
      } else
        ((e = f.treeContext),
          (Ye = on(y.nextSibling)),
          (pt = t),
          (De = !0),
          (pr = null),
          (an = !1),
          e !== null && Yh(t, e),
          (t = jo(t, l)),
          (t.flags |= 4096));
      return t;
    }
    return (
      (e = kn(e.child, { mode: l.mode, children: l.children })),
      (e.ref = t.ref),
      (t.child = e),
      (e.return = t),
      e
    );
  }
  function zo(e, t) {
    var r = t.ref;
    if (r === null) e !== null && e.ref !== null && (t.flags |= 4194816);
    else {
      if (typeof r != "function" && typeof r != "object") throw Error(o(284));
      (e === null || e.ref !== r) && (t.flags |= 4194816);
    }
  }
  function Oc(e, t, r, l, u) {
    return (
      ua(t),
      (r = ac(e, t, r, l, void 0, u)),
      (l = ic()),
      e !== null && !lt
        ? (lc(e, t, u), Xn(e, t, u))
        : (De && l && qu(t), (t.flags |= 1), yt(e, t, r, u), t.child)
    );
  }
  function ip(e, t, r, l, u, f) {
    return (
      ua(t),
      (t.updateQueue = null),
      (r = sm(t, l, r, u)),
      om(e),
      (l = ic()),
      e !== null && !lt
        ? (lc(e, t, f), Xn(e, t, f))
        : (De && l && qu(t), (t.flags |= 1), yt(e, t, r, f), t.child)
    );
  }
  function lp(e, t, r, l, u) {
    if ((ua(t), t.stateNode === null)) {
      var f = Xa,
        y = r.contextType;
      (typeof y == "object" && y !== null && (f = vt(y)),
        (f = new r(l, f)),
        (t.memoizedState =
          f.state !== null && f.state !== void 0 ? f.state : null),
        (f.updater = Sc),
        (t.stateNode = f),
        (f._reactInternals = t),
        (f = t.stateNode),
        (f.props = l),
        (f.state = t.memoizedState),
        (f.refs = {}),
        Fu(t),
        (y = r.contextType),
        (f.context = typeof y == "object" && y !== null ? vt(y) : Xa),
        (f.state = t.memoizedState),
        (y = r.getDerivedStateFromProps),
        typeof y == "function" && (xc(t, r, y, l), (f.state = t.memoizedState)),
        typeof r.getDerivedStateFromProps == "function" ||
          typeof f.getSnapshotBeforeUpdate == "function" ||
          (typeof f.UNSAFE_componentWillMount != "function" &&
            typeof f.componentWillMount != "function") ||
          ((y = f.state),
          typeof f.componentWillMount == "function" && f.componentWillMount(),
          typeof f.UNSAFE_componentWillMount == "function" &&
            f.UNSAFE_componentWillMount(),
          y !== f.state && Sc.enqueueReplaceState(f, f.state, null),
          tl(t, l, f, u),
          el(),
          (f.state = t.memoizedState)),
        typeof f.componentDidMount == "function" && (t.flags |= 4194308),
        (l = !0));
    } else if (e === null) {
      f = t.stateNode;
      var x = t.memoizedProps,
        _ = pa(r, x);
      f.props = _;
      var H = f.context,
        X = r.contextType;
      ((y = Xa), typeof X == "object" && X !== null && (y = vt(X)));
      var $ = r.getDerivedStateFromProps;
      ((X =
        typeof $ == "function" ||
        typeof f.getSnapshotBeforeUpdate == "function"),
        (x = t.pendingProps !== x),
        X ||
          (typeof f.UNSAFE_componentWillReceiveProps != "function" &&
            typeof f.componentWillReceiveProps != "function") ||
          ((x || H !== y) && Km(t, f, l, y)),
        (gr = !1));
      var P = t.memoizedState;
      ((f.state = P),
        tl(t, l, f, u),
        el(),
        (H = t.memoizedState),
        x || P !== H || gr
          ? (typeof $ == "function" && (xc(t, r, $, l), (H = t.memoizedState)),
            (_ = gr || Gm(t, r, _, l, P, H, y))
              ? (X ||
                  (typeof f.UNSAFE_componentWillMount != "function" &&
                    typeof f.componentWillMount != "function") ||
                  (typeof f.componentWillMount == "function" &&
                    f.componentWillMount(),
                  typeof f.UNSAFE_componentWillMount == "function" &&
                    f.UNSAFE_componentWillMount()),
                typeof f.componentDidMount == "function" &&
                  (t.flags |= 4194308))
              : (typeof f.componentDidMount == "function" &&
                  (t.flags |= 4194308),
                (t.memoizedProps = l),
                (t.memoizedState = H)),
            (f.props = l),
            (f.state = H),
            (f.context = y),
            (l = _))
          : (typeof f.componentDidMount == "function" && (t.flags |= 4194308),
            (l = !1)));
    } else {
      ((f = t.stateNode),
        $u(e, t),
        (y = t.memoizedProps),
        (X = pa(r, y)),
        (f.props = X),
        ($ = t.pendingProps),
        (P = f.context),
        (H = r.contextType),
        (_ = Xa),
        typeof H == "object" && H !== null && (_ = vt(H)),
        (x = r.getDerivedStateFromProps),
        (H =
          typeof x == "function" ||
          typeof f.getSnapshotBeforeUpdate == "function") ||
          (typeof f.UNSAFE_componentWillReceiveProps != "function" &&
            typeof f.componentWillReceiveProps != "function") ||
          ((y !== $ || P !== _) && Km(t, f, l, _)),
        (gr = !1),
        (P = t.memoizedState),
        (f.state = P),
        tl(t, l, f, u),
        el());
      var Y = t.memoizedState;
      y !== $ ||
      P !== Y ||
      gr ||
      (e !== null && e.dependencies !== null && po(e.dependencies))
        ? (typeof x == "function" && (xc(t, r, x, l), (Y = t.memoizedState)),
          (X =
            gr ||
            Gm(t, r, X, l, P, Y, _) ||
            (e !== null && e.dependencies !== null && po(e.dependencies)))
            ? (H ||
                (typeof f.UNSAFE_componentWillUpdate != "function" &&
                  typeof f.componentWillUpdate != "function") ||
                (typeof f.componentWillUpdate == "function" &&
                  f.componentWillUpdate(l, Y, _),
                typeof f.UNSAFE_componentWillUpdate == "function" &&
                  f.UNSAFE_componentWillUpdate(l, Y, _)),
              typeof f.componentDidUpdate == "function" && (t.flags |= 4),
              typeof f.getSnapshotBeforeUpdate == "function" &&
                (t.flags |= 1024))
            : (typeof f.componentDidUpdate != "function" ||
                (y === e.memoizedProps && P === e.memoizedState) ||
                (t.flags |= 4),
              typeof f.getSnapshotBeforeUpdate != "function" ||
                (y === e.memoizedProps && P === e.memoizedState) ||
                (t.flags |= 1024),
              (t.memoizedProps = l),
              (t.memoizedState = Y)),
          (f.props = l),
          (f.state = Y),
          (f.context = _),
          (l = X))
        : (typeof f.componentDidUpdate != "function" ||
            (y === e.memoizedProps && P === e.memoizedState) ||
            (t.flags |= 4),
          typeof f.getSnapshotBeforeUpdate != "function" ||
            (y === e.memoizedProps && P === e.memoizedState) ||
            (t.flags |= 1024),
          (l = !1));
    }
    return (
      (f = l),
      zo(e, t),
      (l = (t.flags & 128) !== 0),
      f || l
        ? ((f = t.stateNode),
          (r =
            l && typeof r.getDerivedStateFromError != "function"
              ? null
              : f.render()),
          (t.flags |= 1),
          e !== null && l
            ? ((t.child = ha(t, e.child, null, u)),
              (t.child = ha(t, null, r, u)))
            : yt(e, t, r, u),
          (t.memoizedState = f.state),
          (e = t.child))
        : (e = Xn(e, t, u)),
      e
    );
  }
  function op(e, t, r, l) {
    return (oa(), (t.flags |= 256), yt(e, t, r, l), t.child);
  }
  var Cc = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null,
  };
  function Tc(e) {
    return { baseLanes: e, cachePool: Fh() };
  }
  function _c(e, t, r) {
    return ((e = e !== null ? e.childLanes & ~r : 0), t && (e |= Xt), e);
  }
  function sp(e, t, r) {
    var l = t.pendingProps,
      u = !1,
      f = (t.flags & 128) !== 0,
      y;
    if (
      ((y = f) ||
        (y =
          e !== null && e.memoizedState === null ? !1 : (tt.current & 2) !== 0),
      y && ((u = !0), (t.flags &= -129)),
      (y = (t.flags & 32) !== 0),
      (t.flags &= -33),
      e === null)
    ) {
      if (De) {
        if (
          (u ? Sr(t) : wr(),
          (e = Ye)
            ? ((e = vv(e, an)),
              (e = e !== null && e.data !== "&" ? e : null),
              e !== null &&
                ((t.memoizedState = {
                  dehydrated: e,
                  treeContext: mr !== null ? { id: On, overflow: Cn } : null,
                  retryLane: 536870912,
                  hydrationErrors: null,
                }),
                (r = kh(e)),
                (r.return = t),
                (t.child = r),
                (pt = t),
                (Ye = null)))
            : (e = null),
          e === null)
        )
          throw vr(t);
        return (cf(e) ? (t.lanes = 32) : (t.lanes = 536870912), null);
      }
      var x = l.children;
      return (
        (l = l.fallback),
        u
          ? (wr(),
            (u = t.mode),
            (x = Uo({ mode: "hidden", children: x }, u)),
            (l = la(l, u, r, null)),
            (x.return = t),
            (l.return = t),
            (x.sibling = l),
            (t.child = x),
            (l = t.child),
            (l.memoizedState = Tc(r)),
            (l.childLanes = _c(e, y, r)),
            (t.memoizedState = Cc),
            ll(null, l))
          : (Sr(t), Ac(t, x))
      );
    }
    var _ = e.memoizedState;
    if (_ !== null && ((x = _.dehydrated), x !== null)) {
      if (f)
        t.flags & 256
          ? (Sr(t), (t.flags &= -257), (t = Rc(e, t, r)))
          : t.memoizedState !== null
            ? (wr(), (t.child = e.child), (t.flags |= 128), (t = null))
            : (wr(),
              (x = l.fallback),
              (u = t.mode),
              (l = Uo({ mode: "visible", children: l.children }, u)),
              (x = la(x, u, r, null)),
              (x.flags |= 2),
              (l.return = t),
              (x.return = t),
              (l.sibling = x),
              (t.child = l),
              ha(t, e.child, null, r),
              (l = t.child),
              (l.memoizedState = Tc(r)),
              (l.childLanes = _c(e, y, r)),
              (t.memoizedState = Cc),
              (t = ll(null, l)));
      else if ((Sr(t), cf(x))) {
        if (((y = x.nextSibling && x.nextSibling.dataset), y)) var H = y.dgst;
        ((y = H),
          (l = Error(o(419))),
          (l.stack = ""),
          (l.digest = y),
          Ii({ value: l, source: null, stack: null }),
          (t = Rc(e, t, r)));
      } else if (
        (lt || $a(e, t, r, !1), (y = (r & e.childLanes) !== 0), lt || y)
      ) {
        if (
          ((y = Qe),
          y !== null && ((l = Dt(y, r)), l !== 0 && l !== _.retryLane))
        )
          throw ((_.retryLane = l), ia(e, l), qt(y, e, l), Ec);
        (uf(x) || Yo(), (t = Rc(e, t, r)));
      } else
        uf(x)
          ? ((t.flags |= 192), (t.child = e.child), (t = null))
          : ((e = _.treeContext),
            (Ye = on(x.nextSibling)),
            (pt = t),
            (De = !0),
            (pr = null),
            (an = !1),
            e !== null && Yh(t, e),
            (t = Ac(t, l.children)),
            (t.flags |= 4096));
      return t;
    }
    return u
      ? (wr(),
        (x = l.fallback),
        (u = t.mode),
        (_ = e.child),
        (H = _.sibling),
        (l = kn(_, { mode: "hidden", children: l.children })),
        (l.subtreeFlags = _.subtreeFlags & 65011712),
        H !== null ? (x = kn(H, x)) : ((x = la(x, u, r, null)), (x.flags |= 2)),
        (x.return = t),
        (l.return = t),
        (l.sibling = x),
        (t.child = l),
        ll(null, l),
        (l = t.child),
        (x = e.child.memoizedState),
        x === null
          ? (x = Tc(r))
          : ((u = x.cachePool),
            u !== null
              ? ((_ = at._currentValue),
                (u = u.parent !== _ ? { parent: _, pool: _ } : u))
              : (u = Fh()),
            (x = { baseLanes: x.baseLanes | r, cachePool: u })),
        (l.memoizedState = x),
        (l.childLanes = _c(e, y, r)),
        (t.memoizedState = Cc),
        ll(e.child, l))
      : (Sr(t),
        (r = e.child),
        (e = r.sibling),
        (r = kn(r, { mode: "visible", children: l.children })),
        (r.return = t),
        (r.sibling = null),
        e !== null &&
          ((y = t.deletions),
          y === null ? ((t.deletions = [e]), (t.flags |= 16)) : y.push(e)),
        (t.child = r),
        (t.memoizedState = null),
        r);
  }
  function Ac(e, t) {
    return (
      (t = Uo({ mode: "visible", children: t }, e.mode)),
      (t.return = e),
      (e.child = t)
    );
  }
  function Uo(e, t) {
    return ((e = Vt(22, e, null, t)), (e.lanes = 0), e);
  }
  function Rc(e, t, r) {
    return (
      ha(t, e.child, null, r),
      (e = Ac(t, t.pendingProps.children)),
      (e.flags |= 2),
      (t.memoizedState = null),
      e
    );
  }
  function up(e, t, r) {
    e.lanes |= t;
    var l = e.alternate;
    (l !== null && (l.lanes |= t), Yu(e.return, t, r));
  }
  function Mc(e, t, r, l, u, f) {
    var y = e.memoizedState;
    y === null
      ? (e.memoizedState = {
          isBackwards: t,
          rendering: null,
          renderingStartTime: 0,
          last: l,
          tail: r,
          tailMode: u,
          treeForkCount: f,
        })
      : ((y.isBackwards = t),
        (y.rendering = null),
        (y.renderingStartTime = 0),
        (y.last = l),
        (y.tail = r),
        (y.tailMode = u),
        (y.treeForkCount = f));
  }
  function cp(e, t, r) {
    var l = t.pendingProps,
      u = l.revealOrder,
      f = l.tail;
    l = l.children;
    var y = tt.current,
      x = (y & 2) !== 0;
    if (
      (x ? ((y = (y & 1) | 2), (t.flags |= 128)) : (y &= 1),
      k(tt, y),
      yt(e, t, l, r),
      (l = De ? Xi : 0),
      !x && e !== null && (e.flags & 128) !== 0)
    )
      e: for (e = t.child; e !== null; ) {
        if (e.tag === 13) e.memoizedState !== null && up(e, r, t);
        else if (e.tag === 19) up(e, r, t);
        else if (e.child !== null) {
          ((e.child.return = e), (e = e.child));
          continue;
        }
        if (e === t) break e;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) break e;
          e = e.return;
        }
        ((e.sibling.return = e.return), (e = e.sibling));
      }
    switch (u) {
      case "forwards":
        for (r = t.child, u = null; r !== null; )
          ((e = r.alternate),
            e !== null && Eo(e) === null && (u = r),
            (r = r.sibling));
        ((r = u),
          r === null
            ? ((u = t.child), (t.child = null))
            : ((u = r.sibling), (r.sibling = null)),
          Mc(t, !1, u, r, f, l));
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (r = null, u = t.child, t.child = null; u !== null; ) {
          if (((e = u.alternate), e !== null && Eo(e) === null)) {
            t.child = u;
            break;
          }
          ((e = u.sibling), (u.sibling = r), (r = u), (u = e));
        }
        Mc(t, !0, r, null, f, l);
        break;
      case "together":
        Mc(t, !1, null, null, void 0, l);
        break;
      default:
        t.memoizedState = null;
    }
    return t.child;
  }
  function Xn(e, t, r) {
    if (
      (e !== null && (t.dependencies = e.dependencies),
      (Cr |= t.lanes),
      (r & t.childLanes) === 0)
    )
      if (e !== null) {
        if (($a(e, t, r, !1), (r & t.childLanes) === 0)) return null;
      } else return null;
    if (e !== null && t.child !== e.child) throw Error(o(153));
    if (t.child !== null) {
      for (
        e = t.child, r = kn(e, e.pendingProps), t.child = r, r.return = t;
        e.sibling !== null;
      )
        ((e = e.sibling),
          (r = r.sibling = kn(e, e.pendingProps)),
          (r.return = t));
      r.sibling = null;
    }
    return t.child;
  }
  function Nc(e, t) {
    return (e.lanes & t) !== 0
      ? !0
      : ((e = e.dependencies), !!(e !== null && po(e)));
  }
  function OS(e, t, r) {
    switch (t.tag) {
      case 3:
        (de(t, t.stateNode.containerInfo),
          yr(t, at, e.memoizedState.cache),
          oa());
        break;
      case 27:
      case 5:
        Oe(t);
        break;
      case 4:
        de(t, t.stateNode.containerInfo);
        break;
      case 10:
        yr(t, t.type, t.memoizedProps.value);
        break;
      case 31:
        if (t.memoizedState !== null) return ((t.flags |= 128), nc(t), null);
        break;
      case 13:
        var l = t.memoizedState;
        if (l !== null)
          return l.dehydrated !== null
            ? (Sr(t), (t.flags |= 128), null)
            : (r & t.child.childLanes) !== 0
              ? sp(e, t, r)
              : (Sr(t), (e = Xn(e, t, r)), e !== null ? e.sibling : null);
        Sr(t);
        break;
      case 19:
        var u = (e.flags & 128) !== 0;
        if (
          ((l = (r & t.childLanes) !== 0),
          l || ($a(e, t, r, !1), (l = (r & t.childLanes) !== 0)),
          u)
        ) {
          if (l) return cp(e, t, r);
          t.flags |= 128;
        }
        if (
          ((u = t.memoizedState),
          u !== null &&
            ((u.rendering = null), (u.tail = null), (u.lastEffect = null)),
          k(tt, tt.current),
          l)
        )
          break;
        return null;
      case 22:
        return ((t.lanes = 0), np(e, t, r, t.pendingProps));
      case 24:
        yr(t, at, e.memoizedState.cache);
    }
    return Xn(e, t, r);
  }
  function fp(e, t, r) {
    if (e !== null)
      if (e.memoizedProps !== t.pendingProps) lt = !0;
      else {
        if (!Nc(e, r) && (t.flags & 128) === 0) return ((lt = !1), OS(e, t, r));
        lt = (e.flags & 131072) !== 0;
      }
    else ((lt = !1), De && (t.flags & 1048576) !== 0 && Vh(t, Xi, t.index));
    switch (((t.lanes = 0), t.tag)) {
      case 16:
        e: {
          var l = t.pendingProps;
          if (((e = fa(t.elementType)), (t.type = e), typeof e == "function"))
            Lu(e)
              ? ((l = pa(e, l)), (t.tag = 1), (t = lp(null, t, e, l, r)))
              : ((t.tag = 0), (t = Oc(null, t, e, l, r)));
          else {
            if (e != null) {
              var u = e.$$typeof;
              if (u === Z) {
                ((t.tag = 11), (t = Wm(null, t, e, l, r)));
                break e;
              } else if (u === N) {
                ((t.tag = 14), (t = ep(null, t, e, l, r)));
                break e;
              }
            }
            throw ((t = se(e) || e), Error(o(306, t, "")));
          }
        }
        return t;
      case 0:
        return Oc(e, t, t.type, t.pendingProps, r);
      case 1:
        return ((l = t.type), (u = pa(l, t.pendingProps)), lp(e, t, l, u, r));
      case 3:
        e: {
          if ((de(t, t.stateNode.containerInfo), e === null))
            throw Error(o(387));
          l = t.pendingProps;
          var f = t.memoizedState;
          ((u = f.element), $u(e, t), tl(t, l, null, r));
          var y = t.memoizedState;
          if (
            ((l = y.cache),
            yr(t, at, l),
            l !== f.cache && Gu(t, [at], r, !0),
            el(),
            (l = y.element),
            f.isDehydrated)
          )
            if (
              ((f = { element: l, isDehydrated: !1, cache: y.cache }),
              (t.updateQueue.baseState = f),
              (t.memoizedState = f),
              t.flags & 256)
            ) {
              t = op(e, t, l, r);
              break e;
            } else if (l !== u) {
              ((u = tn(Error(o(424)), t)), Ii(u), (t = op(e, t, l, r)));
              break e;
            } else
              for (
                e = t.stateNode.containerInfo,
                  e.nodeType === 9
                    ? (e = e.body)
                    : (e = e.nodeName === "HTML" ? e.ownerDocument.body : e),
                  Ye = on(e.firstChild),
                  pt = t,
                  De = !0,
                  pr = null,
                  an = !0,
                  r = nm(t, null, l, r),
                  t.child = r;
                r;
              )
                ((r.flags = (r.flags & -3) | 4096), (r = r.sibling));
          else {
            if ((oa(), l === u)) {
              t = Xn(e, t, r);
              break e;
            }
            yt(e, t, l, r);
          }
          t = t.child;
        }
        return t;
      case 26:
        return (
          zo(e, t),
          e === null
            ? (r = wv(t.type, null, t.pendingProps, null))
              ? (t.memoizedState = r)
              : De ||
                ((r = t.type),
                (e = t.pendingProps),
                (l = $o(ue.current).createElement(r)),
                (l[mt] = t),
                (l[jt] = e),
                gt(l, r, e),
                dt(l),
                (t.stateNode = l))
            : (t.memoizedState = wv(
                t.type,
                e.memoizedProps,
                t.pendingProps,
                e.memoizedState,
              )),
          null
        );
      case 27:
        return (
          Oe(t),
          e === null &&
            De &&
            ((l = t.stateNode = bv(t.type, t.pendingProps, ue.current)),
            (pt = t),
            (an = !0),
            (u = Ye),
            Mr(t.type) ? ((ff = u), (Ye = on(l.firstChild))) : (Ye = u)),
          yt(e, t, t.pendingProps.children, r),
          zo(e, t),
          e === null && (t.flags |= 4194304),
          t.child
        );
      case 5:
        return (
          e === null &&
            De &&
            ((u = l = Ye) &&
              ((l = e1(l, t.type, t.pendingProps, an)),
              l !== null
                ? ((t.stateNode = l),
                  (pt = t),
                  (Ye = on(l.firstChild)),
                  (an = !1),
                  (u = !0))
                : (u = !1)),
            u || vr(t)),
          Oe(t),
          (u = t.type),
          (f = t.pendingProps),
          (y = e !== null ? e.memoizedProps : null),
          (l = f.children),
          lf(u, f) ? (l = null) : y !== null && lf(u, y) && (t.flags |= 32),
          t.memoizedState !== null &&
            ((u = ac(e, t, pS, null, null, r)), (Sl._currentValue = u)),
          zo(e, t),
          yt(e, t, l, r),
          t.child
        );
      case 6:
        return (
          e === null &&
            De &&
            ((e = r = Ye) &&
              ((r = t1(r, t.pendingProps, an)),
              r !== null
                ? ((t.stateNode = r), (pt = t), (Ye = null), (e = !0))
                : (e = !1)),
            e || vr(t)),
          null
        );
      case 13:
        return sp(e, t, r);
      case 4:
        return (
          de(t, t.stateNode.containerInfo),
          (l = t.pendingProps),
          e === null ? (t.child = ha(t, null, l, r)) : yt(e, t, l, r),
          t.child
        );
      case 11:
        return Wm(e, t, t.type, t.pendingProps, r);
      case 7:
        return (yt(e, t, t.pendingProps, r), t.child);
      case 8:
        return (yt(e, t, t.pendingProps.children, r), t.child);
      case 12:
        return (yt(e, t, t.pendingProps.children, r), t.child);
      case 10:
        return (
          (l = t.pendingProps),
          yr(t, t.type, l.value),
          yt(e, t, l.children, r),
          t.child
        );
      case 9:
        return (
          (u = t.type._context),
          (l = t.pendingProps.children),
          ua(t),
          (u = vt(u)),
          (l = l(u)),
          (t.flags |= 1),
          yt(e, t, l, r),
          t.child
        );
      case 14:
        return ep(e, t, t.type, t.pendingProps, r);
      case 15:
        return tp(e, t, t.type, t.pendingProps, r);
      case 19:
        return cp(e, t, r);
      case 31:
        return ES(e, t, r);
      case 22:
        return np(e, t, r, t.pendingProps);
      case 24:
        return (
          ua(t),
          (l = vt(at)),
          e === null
            ? ((u = Iu()),
              u === null &&
                ((u = Qe),
                (f = Ku()),
                (u.pooledCache = f),
                f.refCount++,
                f !== null && (u.pooledCacheLanes |= r),
                (u = f)),
              (t.memoizedState = { parent: l, cache: u }),
              Fu(t),
              yr(t, at, u))
            : ((e.lanes & r) !== 0 && ($u(e, t), tl(t, null, null, r), el()),
              (u = e.memoizedState),
              (f = t.memoizedState),
              u.parent !== l
                ? ((u = { parent: l, cache: l }),
                  (t.memoizedState = u),
                  t.lanes === 0 &&
                    (t.memoizedState = t.updateQueue.baseState = u),
                  yr(t, at, l))
                : ((l = f.cache),
                  yr(t, at, l),
                  l !== u.cache && Gu(t, [at], r, !0))),
          yt(e, t, t.pendingProps.children, r),
          t.child
        );
      case 29:
        throw t.pendingProps;
    }
    throw Error(o(156, t.tag));
  }
  function In(e) {
    e.flags |= 4;
  }
  function Dc(e, t, r, l, u) {
    if (((t = (e.mode & 32) !== 0) && (t = !1), t)) {
      if (((e.flags |= 16777216), (u & 335544128) === u))
        if (e.stateNode.complete) e.flags |= 8192;
        else if (Bp()) e.flags |= 8192;
        else throw ((da = bo), Zu);
    } else e.flags &= -16777217;
  }
  function dp(e, t) {
    if (t.type !== "stylesheet" || (t.state.loading & 4) !== 0)
      e.flags &= -16777217;
    else if (((e.flags |= 16777216), !_v(t)))
      if (Bp()) e.flags |= 8192;
      else throw ((da = bo), Zu);
  }
  function Lo(e, t) {
    (t !== null && (e.flags |= 4),
      e.flags & 16384 &&
        ((t = e.tag !== 22 ? xt() : 536870912), (e.lanes |= t), (ui |= t)));
  }
  function ol(e, t) {
    if (!De)
      switch (e.tailMode) {
        case "hidden":
          t = e.tail;
          for (var r = null; t !== null; )
            (t.alternate !== null && (r = t), (t = t.sibling));
          r === null ? (e.tail = null) : (r.sibling = null);
          break;
        case "collapsed":
          r = e.tail;
          for (var l = null; r !== null; )
            (r.alternate !== null && (l = r), (r = r.sibling));
          l === null
            ? t || e.tail === null
              ? (e.tail = null)
              : (e.tail.sibling = null)
            : (l.sibling = null);
      }
  }
  function Ge(e) {
    var t = e.alternate !== null && e.alternate.child === e.child,
      r = 0,
      l = 0;
    if (t)
      for (var u = e.child; u !== null; )
        ((r |= u.lanes | u.childLanes),
          (l |= u.subtreeFlags & 65011712),
          (l |= u.flags & 65011712),
          (u.return = e),
          (u = u.sibling));
    else
      for (u = e.child; u !== null; )
        ((r |= u.lanes | u.childLanes),
          (l |= u.subtreeFlags),
          (l |= u.flags),
          (u.return = e),
          (u = u.sibling));
    return ((e.subtreeFlags |= l), (e.childLanes = r), t);
  }
  function CS(e, t, r) {
    var l = t.pendingProps;
    switch ((Pu(t), t.tag)) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return (Ge(t), null);
      case 1:
        return (Ge(t), null);
      case 3:
        return (
          (r = t.stateNode),
          (l = null),
          e !== null && (l = e.memoizedState.cache),
          t.memoizedState.cache !== l && (t.flags |= 2048),
          Yn(at),
          pe(),
          r.pendingContext &&
            ((r.context = r.pendingContext), (r.pendingContext = null)),
          (e === null || e.child === null) &&
            (Fa(t)
              ? In(t)
              : e === null ||
                (e.memoizedState.isDehydrated && (t.flags & 256) === 0) ||
                ((t.flags |= 1024), Qu())),
          Ge(t),
          null
        );
      case 26:
        var u = t.type,
          f = t.memoizedState;
        return (
          e === null
            ? (In(t),
              f !== null ? (Ge(t), dp(t, f)) : (Ge(t), Dc(t, u, null, l, r)))
            : f
              ? f !== e.memoizedState
                ? (In(t), Ge(t), dp(t, f))
                : (Ge(t), (t.flags &= -16777217))
              : ((e = e.memoizedProps),
                e !== l && In(t),
                Ge(t),
                Dc(t, u, e, l, r)),
          null
        );
      case 27:
        if (
          (Ce(t),
          (r = ue.current),
          (u = t.type),
          e !== null && t.stateNode != null)
        )
          e.memoizedProps !== l && In(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(o(166));
            return (Ge(t), null);
          }
          ((e = I.current),
            Fa(t) ? Gh(t) : ((e = bv(u, l, r)), (t.stateNode = e), In(t)));
        }
        return (Ge(t), null);
      case 5:
        if ((Ce(t), (u = t.type), e !== null && t.stateNode != null))
          e.memoizedProps !== l && In(t);
        else {
          if (!l) {
            if (t.stateNode === null) throw Error(o(166));
            return (Ge(t), null);
          }
          if (((f = I.current), Fa(t))) Gh(t);
          else {
            var y = $o(ue.current);
            switch (f) {
              case 1:
                f = y.createElementNS("http://www.w3.org/2000/svg", u);
                break;
              case 2:
                f = y.createElementNS("http://www.w3.org/1998/Math/MathML", u);
                break;
              default:
                switch (u) {
                  case "svg":
                    f = y.createElementNS("http://www.w3.org/2000/svg", u);
                    break;
                  case "math":
                    f = y.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      u,
                    );
                    break;
                  case "script":
                    ((f = y.createElement("div")),
                      (f.innerHTML = "<script><\/script>"),
                      (f = f.removeChild(f.firstChild)));
                    break;
                  case "select":
                    ((f =
                      typeof l.is == "string"
                        ? y.createElement("select", { is: l.is })
                        : y.createElement("select")),
                      l.multiple
                        ? (f.multiple = !0)
                        : l.size && (f.size = l.size));
                    break;
                  default:
                    f =
                      typeof l.is == "string"
                        ? y.createElement(u, { is: l.is })
                        : y.createElement(u);
                }
            }
            ((f[mt] = t), (f[jt] = l));
            e: for (y = t.child; y !== null; ) {
              if (y.tag === 5 || y.tag === 6) f.appendChild(y.stateNode);
              else if (y.tag !== 4 && y.tag !== 27 && y.child !== null) {
                ((y.child.return = y), (y = y.child));
                continue;
              }
              if (y === t) break e;
              for (; y.sibling === null; ) {
                if (y.return === null || y.return === t) break e;
                y = y.return;
              }
              ((y.sibling.return = y.return), (y = y.sibling));
            }
            t.stateNode = f;
            e: switch ((gt(f, u, l), u)) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break e;
              case "img":
                l = !0;
                break e;
              default:
                l = !1;
            }
            l && In(t);
          }
        }
        return (
          Ge(t),
          Dc(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, r),
          null
        );
      case 6:
        if (e && t.stateNode != null) e.memoizedProps !== l && In(t);
        else {
          if (typeof l != "string" && t.stateNode === null) throw Error(o(166));
          if (((e = ue.current), Fa(t))) {
            if (
              ((e = t.stateNode),
              (r = t.memoizedProps),
              (l = null),
              (u = pt),
              u !== null)
            )
              switch (u.tag) {
                case 27:
                case 5:
                  l = u.memoizedProps;
              }
            ((e[mt] = t),
              (e = !!(
                e.nodeValue === r ||
                (l !== null && l.suppressHydrationWarning === !0) ||
                sv(e.nodeValue, r)
              )),
              e || vr(t, !0));
          } else
            ((e = $o(e).createTextNode(l)), (e[mt] = t), (t.stateNode = e));
        }
        return (Ge(t), null);
      case 31:
        if (((r = t.memoizedState), e === null || e.memoizedState !== null)) {
          if (((l = Fa(t)), r !== null)) {
            if (e === null) {
              if (!l) throw Error(o(318));
              if (
                ((e = t.memoizedState),
                (e = e !== null ? e.dehydrated : null),
                !e)
              )
                throw Error(o(557));
              e[mt] = t;
            } else
              (oa(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (Ge(t), (e = !1));
          } else
            ((r = Qu()),
              e !== null &&
                e.memoizedState !== null &&
                (e.memoizedState.hydrationErrors = r),
              (e = !0));
          if (!e) return t.flags & 256 ? (Gt(t), t) : (Gt(t), null);
          if ((t.flags & 128) !== 0) throw Error(o(558));
        }
        return (Ge(t), null);
      case 13:
        if (
          ((l = t.memoizedState),
          e === null ||
            (e.memoizedState !== null && e.memoizedState.dehydrated !== null))
        ) {
          if (((u = Fa(t)), l !== null && l.dehydrated !== null)) {
            if (e === null) {
              if (!u) throw Error(o(318));
              if (
                ((u = t.memoizedState),
                (u = u !== null ? u.dehydrated : null),
                !u)
              )
                throw Error(o(317));
              u[mt] = t;
            } else
              (oa(),
                (t.flags & 128) === 0 && (t.memoizedState = null),
                (t.flags |= 4));
            (Ge(t), (u = !1));
          } else
            ((u = Qu()),
              e !== null &&
                e.memoizedState !== null &&
                (e.memoizedState.hydrationErrors = u),
              (u = !0));
          if (!u) return t.flags & 256 ? (Gt(t), t) : (Gt(t), null);
        }
        return (
          Gt(t),
          (t.flags & 128) !== 0
            ? ((t.lanes = r), t)
            : ((r = l !== null),
              (e = e !== null && e.memoizedState !== null),
              r &&
                ((l = t.child),
                (u = null),
                l.alternate !== null &&
                  l.alternate.memoizedState !== null &&
                  l.alternate.memoizedState.cachePool !== null &&
                  (u = l.alternate.memoizedState.cachePool.pool),
                (f = null),
                l.memoizedState !== null &&
                  l.memoizedState.cachePool !== null &&
                  (f = l.memoizedState.cachePool.pool),
                f !== u && (l.flags |= 2048)),
              r !== e && r && (t.child.flags |= 8192),
              Lo(t, t.updateQueue),
              Ge(t),
              null)
        );
      case 4:
        return (pe(), e === null && ef(t.stateNode.containerInfo), Ge(t), null);
      case 10:
        return (Yn(t.type), Ge(t), null);
      case 19:
        if ((G(tt), (l = t.memoizedState), l === null)) return (Ge(t), null);
        if (((u = (t.flags & 128) !== 0), (f = l.rendering), f === null))
          if (u) ol(l, !1);
          else {
            if ($e !== 0 || (e !== null && (e.flags & 128) !== 0))
              for (e = t.child; e !== null; ) {
                if (((f = Eo(e)), f !== null)) {
                  for (
                    t.flags |= 128,
                      ol(l, !1),
                      e = f.updateQueue,
                      t.updateQueue = e,
                      Lo(t, e),
                      t.subtreeFlags = 0,
                      e = r,
                      r = t.child;
                    r !== null;
                  )
                    (Ph(r, e), (r = r.sibling));
                  return (
                    k(tt, (tt.current & 1) | 2),
                    De && Qn(t, l.treeForkCount),
                    t.child
                  );
                }
                e = e.sibling;
              }
            l.tail !== null &&
              Tt() > ko &&
              ((t.flags |= 128), (u = !0), ol(l, !1), (t.lanes = 4194304));
          }
        else {
          if (!u)
            if (((e = Eo(f)), e !== null)) {
              if (
                ((t.flags |= 128),
                (u = !0),
                (e = e.updateQueue),
                (t.updateQueue = e),
                Lo(t, e),
                ol(l, !0),
                l.tail === null &&
                  l.tailMode === "hidden" &&
                  !f.alternate &&
                  !De)
              )
                return (Ge(t), null);
            } else
              2 * Tt() - l.renderingStartTime > ko &&
                r !== 536870912 &&
                ((t.flags |= 128), (u = !0), ol(l, !1), (t.lanes = 4194304));
          l.isBackwards
            ? ((f.sibling = t.child), (t.child = f))
            : ((e = l.last),
              e !== null ? (e.sibling = f) : (t.child = f),
              (l.last = f));
        }
        return l.tail !== null
          ? ((e = l.tail),
            (l.rendering = e),
            (l.tail = e.sibling),
            (l.renderingStartTime = Tt()),
            (e.sibling = null),
            (r = tt.current),
            k(tt, u ? (r & 1) | 2 : r & 1),
            De && Qn(t, l.treeForkCount),
            e)
          : (Ge(t), null);
      case 22:
      case 23:
        return (
          Gt(t),
          tc(),
          (l = t.memoizedState !== null),
          e !== null
            ? (e.memoizedState !== null) !== l && (t.flags |= 8192)
            : l && (t.flags |= 8192),
          l
            ? (r & 536870912) !== 0 &&
              (t.flags & 128) === 0 &&
              (Ge(t), t.subtreeFlags & 6 && (t.flags |= 8192))
            : Ge(t),
          (r = t.updateQueue),
          r !== null && Lo(t, r.retryQueue),
          (r = null),
          e !== null &&
            e.memoizedState !== null &&
            e.memoizedState.cachePool !== null &&
            (r = e.memoizedState.cachePool.pool),
          (l = null),
          t.memoizedState !== null &&
            t.memoizedState.cachePool !== null &&
            (l = t.memoizedState.cachePool.pool),
          l !== r && (t.flags |= 2048),
          e !== null && G(ca),
          null
        );
      case 24:
        return (
          (r = null),
          e !== null && (r = e.memoizedState.cache),
          t.memoizedState.cache !== r && (t.flags |= 2048),
          Yn(at),
          Ge(t),
          null
        );
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(o(156, t.tag));
  }
  function TS(e, t) {
    switch ((Pu(t), t.tag)) {
      case 1:
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 3:
        return (
          Yn(at),
          pe(),
          (e = t.flags),
          (e & 65536) !== 0 && (e & 128) === 0
            ? ((t.flags = (e & -65537) | 128), t)
            : null
        );
      case 26:
      case 27:
      case 5:
        return (Ce(t), null);
      case 31:
        if (t.memoizedState !== null) {
          if ((Gt(t), t.alternate === null)) throw Error(o(340));
          oa();
        }
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 13:
        if (
          (Gt(t), (e = t.memoizedState), e !== null && e.dehydrated !== null)
        ) {
          if (t.alternate === null) throw Error(o(340));
          oa();
        }
        return (
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 19:
        return (G(tt), null);
      case 4:
        return (pe(), null);
      case 10:
        return (Yn(t.type), null);
      case 22:
      case 23:
        return (
          Gt(t),
          tc(),
          e !== null && G(ca),
          (e = t.flags),
          e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null
        );
      case 24:
        return (Yn(at), null);
      case 25:
        return null;
      default:
        return null;
    }
  }
  function hp(e, t) {
    switch ((Pu(t), t.tag)) {
      case 3:
        (Yn(at), pe());
        break;
      case 26:
      case 27:
      case 5:
        Ce(t);
        break;
      case 4:
        pe();
        break;
      case 31:
        t.memoizedState !== null && Gt(t);
        break;
      case 13:
        Gt(t);
        break;
      case 19:
        G(tt);
        break;
      case 10:
        Yn(t.type);
        break;
      case 22:
      case 23:
        (Gt(t), tc(), e !== null && G(ca));
        break;
      case 24:
        Yn(at);
    }
  }
  function sl(e, t) {
    try {
      var r = t.updateQueue,
        l = r !== null ? r.lastEffect : null;
      if (l !== null) {
        var u = l.next;
        r = u;
        do {
          if ((r.tag & e) === e) {
            l = void 0;
            var f = r.create,
              y = r.inst;
            ((l = f()), (y.destroy = l));
          }
          r = r.next;
        } while (r !== u);
      }
    } catch (x) {
      Be(t, t.return, x);
    }
  }
  function Er(e, t, r) {
    try {
      var l = t.updateQueue,
        u = l !== null ? l.lastEffect : null;
      if (u !== null) {
        var f = u.next;
        l = f;
        do {
          if ((l.tag & e) === e) {
            var y = l.inst,
              x = y.destroy;
            if (x !== void 0) {
              ((y.destroy = void 0), (u = t));
              var _ = r,
                H = x;
              try {
                H();
              } catch (X) {
                Be(u, _, X);
              }
            }
          }
          l = l.next;
        } while (l !== f);
      }
    } catch (X) {
      Be(t, t.return, X);
    }
  }
  function mp(e) {
    var t = e.updateQueue;
    if (t !== null) {
      var r = e.stateNode;
      try {
        am(t, r);
      } catch (l) {
        Be(e, e.return, l);
      }
    }
  }
  function pp(e, t, r) {
    ((r.props = pa(e.type, e.memoizedProps)), (r.state = e.memoizedState));
    try {
      r.componentWillUnmount();
    } catch (l) {
      Be(e, t, l);
    }
  }
  function ul(e, t) {
    try {
      var r = e.ref;
      if (r !== null) {
        switch (e.tag) {
          case 26:
          case 27:
          case 5:
            var l = e.stateNode;
            break;
          case 30:
            l = e.stateNode;
            break;
          default:
            l = e.stateNode;
        }
        typeof r == "function" ? (e.refCleanup = r(l)) : (r.current = l);
      }
    } catch (u) {
      Be(e, t, u);
    }
  }
  function Tn(e, t) {
    var r = e.ref,
      l = e.refCleanup;
    if (r !== null)
      if (typeof l == "function")
        try {
          l();
        } catch (u) {
          Be(e, t, u);
        } finally {
          ((e.refCleanup = null),
            (e = e.alternate),
            e != null && (e.refCleanup = null));
        }
      else if (typeof r == "function")
        try {
          r(null);
        } catch (u) {
          Be(e, t, u);
        }
      else r.current = null;
  }
  function vp(e) {
    var t = e.type,
      r = e.memoizedProps,
      l = e.stateNode;
    try {
      e: switch (t) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          r.autoFocus && l.focus();
          break e;
        case "img":
          r.src ? (l.src = r.src) : r.srcSet && (l.srcset = r.srcSet);
      }
    } catch (u) {
      Be(e, e.return, u);
    }
  }
  function jc(e, t, r) {
    try {
      var l = e.stateNode;
      (IS(l, e.type, r, t), (l[jt] = t));
    } catch (u) {
      Be(e, e.return, u);
    }
  }
  function yp(e) {
    return (
      e.tag === 5 ||
      e.tag === 3 ||
      e.tag === 26 ||
      (e.tag === 27 && Mr(e.type)) ||
      e.tag === 4
    );
  }
  function zc(e) {
    e: for (;;) {
      for (; e.sibling === null; ) {
        if (e.return === null || yp(e.return)) return null;
        e = e.return;
      }
      for (
        e.sibling.return = e.return, e = e.sibling;
        e.tag !== 5 && e.tag !== 6 && e.tag !== 18;
      ) {
        if (
          (e.tag === 27 && Mr(e.type)) ||
          e.flags & 2 ||
          e.child === null ||
          e.tag === 4
        )
          continue e;
        ((e.child.return = e), (e = e.child));
      }
      if (!(e.flags & 2)) return e.stateNode;
    }
  }
  function Uc(e, t, r) {
    var l = e.tag;
    if (l === 5 || l === 6)
      ((e = e.stateNode),
        t
          ? (r.nodeType === 9
              ? r.body
              : r.nodeName === "HTML"
                ? r.ownerDocument.body
                : r
            ).insertBefore(e, t)
          : ((t =
              r.nodeType === 9
                ? r.body
                : r.nodeName === "HTML"
                  ? r.ownerDocument.body
                  : r),
            t.appendChild(e),
            (r = r._reactRootContainer),
            r != null || t.onclick !== null || (t.onclick = qn)));
    else if (
      l !== 4 &&
      (l === 27 && Mr(e.type) && ((r = e.stateNode), (t = null)),
      (e = e.child),
      e !== null)
    )
      for (Uc(e, t, r), e = e.sibling; e !== null; )
        (Uc(e, t, r), (e = e.sibling));
  }
  function Ho(e, t, r) {
    var l = e.tag;
    if (l === 5 || l === 6)
      ((e = e.stateNode), t ? r.insertBefore(e, t) : r.appendChild(e));
    else if (
      l !== 4 &&
      (l === 27 && Mr(e.type) && (r = e.stateNode), (e = e.child), e !== null)
    )
      for (Ho(e, t, r), e = e.sibling; e !== null; )
        (Ho(e, t, r), (e = e.sibling));
  }
  function gp(e) {
    var t = e.stateNode,
      r = e.memoizedProps;
    try {
      for (var l = e.type, u = t.attributes; u.length; )
        t.removeAttributeNode(u[0]);
      (gt(t, l, r), (t[mt] = e), (t[jt] = r));
    } catch (f) {
      Be(e, e.return, f);
    }
  }
  var Zn = !1,
    ot = !1,
    Lc = !1,
    bp = typeof WeakSet == "function" ? WeakSet : Set,
    ht = null;
  function _S(e, t) {
    if (((e = e.containerInfo), (rf = as), (e = Nh(e)), Ru(e))) {
      if ("selectionStart" in e)
        var r = { start: e.selectionStart, end: e.selectionEnd };
      else
        e: {
          r = ((r = e.ownerDocument) && r.defaultView) || window;
          var l = r.getSelection && r.getSelection();
          if (l && l.rangeCount !== 0) {
            r = l.anchorNode;
            var u = l.anchorOffset,
              f = l.focusNode;
            l = l.focusOffset;
            try {
              (r.nodeType, f.nodeType);
            } catch {
              r = null;
              break e;
            }
            var y = 0,
              x = -1,
              _ = -1,
              H = 0,
              X = 0,
              $ = e,
              P = null;
            t: for (;;) {
              for (
                var Y;
                $ !== r || (u !== 0 && $.nodeType !== 3) || (x = y + u),
                  $ !== f || (l !== 0 && $.nodeType !== 3) || (_ = y + l),
                  $.nodeType === 3 && (y += $.nodeValue.length),
                  (Y = $.firstChild) !== null;
              )
                ((P = $), ($ = Y));
              for (;;) {
                if ($ === e) break t;
                if (
                  (P === r && ++H === u && (x = y),
                  P === f && ++X === l && (_ = y),
                  (Y = $.nextSibling) !== null)
                )
                  break;
                (($ = P), (P = $.parentNode));
              }
              $ = Y;
            }
            r = x === -1 || _ === -1 ? null : { start: x, end: _ };
          } else r = null;
        }
      r = r || { start: 0, end: 0 };
    } else r = null;
    for (
      af = { focusedElem: e, selectionRange: r }, as = !1, ht = t;
      ht !== null;
    )
      if (
        ((t = ht), (e = t.child), (t.subtreeFlags & 1028) !== 0 && e !== null)
      )
        ((e.return = t), (ht = e));
      else
        for (; ht !== null; ) {
          switch (((t = ht), (f = t.alternate), (e = t.flags), t.tag)) {
            case 0:
              if (
                (e & 4) !== 0 &&
                ((e = t.updateQueue),
                (e = e !== null ? e.events : null),
                e !== null)
              )
                for (r = 0; r < e.length; r++)
                  ((u = e[r]), (u.ref.impl = u.nextImpl));
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((e & 1024) !== 0 && f !== null) {
                ((e = void 0),
                  (r = t),
                  (u = f.memoizedProps),
                  (f = f.memoizedState),
                  (l = r.stateNode));
                try {
                  var he = pa(r.type, u);
                  ((e = l.getSnapshotBeforeUpdate(he, f)),
                    (l.__reactInternalSnapshotBeforeUpdate = e));
                } catch (be) {
                  Be(r, r.return, be);
                }
              }
              break;
            case 3:
              if ((e & 1024) !== 0) {
                if (
                  ((e = t.stateNode.containerInfo), (r = e.nodeType), r === 9)
                )
                  sf(e);
                else if (r === 1)
                  switch (e.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      sf(e);
                      break;
                    default:
                      e.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if ((e & 1024) !== 0) throw Error(o(163));
          }
          if (((e = t.sibling), e !== null)) {
            ((e.return = t.return), (ht = e));
            break;
          }
          ht = t.return;
        }
  }
  function xp(e, t, r) {
    var l = r.flags;
    switch (r.tag) {
      case 0:
      case 11:
      case 15:
        ($n(e, r), l & 4 && sl(5, r));
        break;
      case 1:
        if (($n(e, r), l & 4))
          if (((e = r.stateNode), t === null))
            try {
              e.componentDidMount();
            } catch (y) {
              Be(r, r.return, y);
            }
          else {
            var u = pa(r.type, t.memoizedProps);
            t = t.memoizedState;
            try {
              e.componentDidUpdate(u, t, e.__reactInternalSnapshotBeforeUpdate);
            } catch (y) {
              Be(r, r.return, y);
            }
          }
        (l & 64 && mp(r), l & 512 && ul(r, r.return));
        break;
      case 3:
        if (($n(e, r), l & 64 && ((e = r.updateQueue), e !== null))) {
          if (((t = null), r.child !== null))
            switch (r.child.tag) {
              case 27:
              case 5:
                t = r.child.stateNode;
                break;
              case 1:
                t = r.child.stateNode;
            }
          try {
            am(e, t);
          } catch (y) {
            Be(r, r.return, y);
          }
        }
        break;
      case 27:
        t === null && l & 4 && gp(r);
      case 26:
      case 5:
        ($n(e, r), t === null && l & 4 && vp(r), l & 512 && ul(r, r.return));
        break;
      case 12:
        $n(e, r);
        break;
      case 31:
        ($n(e, r), l & 4 && Ep(e, r));
        break;
      case 13:
        ($n(e, r),
          l & 4 && Op(e, r),
          l & 64 &&
            ((e = r.memoizedState),
            e !== null &&
              ((e = e.dehydrated),
              e !== null && ((r = LS.bind(null, r)), n1(e, r)))));
        break;
      case 22:
        if (((l = r.memoizedState !== null || Zn), !l)) {
          ((t = (t !== null && t.memoizedState !== null) || ot), (u = Zn));
          var f = ot;
          ((Zn = l),
            (ot = t) && !f ? Jn(e, r, (r.subtreeFlags & 8772) !== 0) : $n(e, r),
            (Zn = u),
            (ot = f));
        }
        break;
      case 30:
        break;
      default:
        $n(e, r);
    }
  }
  function Sp(e) {
    var t = e.alternate;
    (t !== null && ((e.alternate = null), Sp(t)),
      (e.child = null),
      (e.deletions = null),
      (e.sibling = null),
      e.tag === 5 && ((t = e.stateNode), t !== null && du(t)),
      (e.stateNode = null),
      (e.return = null),
      (e.dependencies = null),
      (e.memoizedProps = null),
      (e.memoizedState = null),
      (e.pendingProps = null),
      (e.stateNode = null),
      (e.updateQueue = null));
  }
  var Ie = null,
    Ut = !1;
  function Fn(e, t, r) {
    for (r = r.child; r !== null; ) (wp(e, t, r), (r = r.sibling));
  }
  function wp(e, t, r) {
    if (_t && typeof _t.onCommitFiberUnmount == "function")
      try {
        _t.onCommitFiberUnmount(Jr, r);
      } catch {}
    switch (r.tag) {
      case 26:
        (ot || Tn(r, t),
          Fn(e, t, r),
          r.memoizedState
            ? r.memoizedState.count--
            : r.stateNode && ((r = r.stateNode), r.parentNode.removeChild(r)));
        break;
      case 27:
        ot || Tn(r, t);
        var l = Ie,
          u = Ut;
        (Mr(r.type) && ((Ie = r.stateNode), (Ut = !1)),
          Fn(e, t, r),
          gl(r.stateNode),
          (Ie = l),
          (Ut = u));
        break;
      case 5:
        ot || Tn(r, t);
      case 6:
        if (
          ((l = Ie),
          (u = Ut),
          (Ie = null),
          Fn(e, t, r),
          (Ie = l),
          (Ut = u),
          Ie !== null)
        )
          if (Ut)
            try {
              (Ie.nodeType === 9
                ? Ie.body
                : Ie.nodeName === "HTML"
                  ? Ie.ownerDocument.body
                  : Ie
              ).removeChild(r.stateNode);
            } catch (f) {
              Be(r, t, f);
            }
          else
            try {
              Ie.removeChild(r.stateNode);
            } catch (f) {
              Be(r, t, f);
            }
        break;
      case 18:
        Ie !== null &&
          (Ut
            ? ((e = Ie),
              mv(
                e.nodeType === 9
                  ? e.body
                  : e.nodeName === "HTML"
                    ? e.ownerDocument.body
                    : e,
                r.stateNode,
              ),
              yi(e))
            : mv(Ie, r.stateNode));
        break;
      case 4:
        ((l = Ie),
          (u = Ut),
          (Ie = r.stateNode.containerInfo),
          (Ut = !0),
          Fn(e, t, r),
          (Ie = l),
          (Ut = u));
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        (Er(2, r, t), ot || Er(4, r, t), Fn(e, t, r));
        break;
      case 1:
        (ot ||
          (Tn(r, t),
          (l = r.stateNode),
          typeof l.componentWillUnmount == "function" && pp(r, t, l)),
          Fn(e, t, r));
        break;
      case 21:
        Fn(e, t, r);
        break;
      case 22:
        ((ot = (l = ot) || r.memoizedState !== null), Fn(e, t, r), (ot = l));
        break;
      default:
        Fn(e, t, r);
    }
  }
  function Ep(e, t) {
    if (
      t.memoizedState === null &&
      ((e = t.alternate), e !== null && ((e = e.memoizedState), e !== null))
    ) {
      e = e.dehydrated;
      try {
        yi(e);
      } catch (r) {
        Be(t, t.return, r);
      }
    }
  }
  function Op(e, t) {
    if (
      t.memoizedState === null &&
      ((e = t.alternate),
      e !== null &&
        ((e = e.memoizedState), e !== null && ((e = e.dehydrated), e !== null)))
    )
      try {
        yi(e);
      } catch (r) {
        Be(t, t.return, r);
      }
  }
  function AS(e) {
    switch (e.tag) {
      case 31:
      case 13:
      case 19:
        var t = e.stateNode;
        return (t === null && (t = e.stateNode = new bp()), t);
      case 22:
        return (
          (e = e.stateNode),
          (t = e._retryCache),
          t === null && (t = e._retryCache = new bp()),
          t
        );
      default:
        throw Error(o(435, e.tag));
    }
  }
  function Bo(e, t) {
    var r = AS(e);
    t.forEach(function (l) {
      if (!r.has(l)) {
        r.add(l);
        var u = HS.bind(null, e, l);
        l.then(u, u);
      }
    });
  }
  function Lt(e, t) {
    var r = t.deletions;
    if (r !== null)
      for (var l = 0; l < r.length; l++) {
        var u = r[l],
          f = e,
          y = t,
          x = y;
        e: for (; x !== null; ) {
          switch (x.tag) {
            case 27:
              if (Mr(x.type)) {
                ((Ie = x.stateNode), (Ut = !1));
                break e;
              }
              break;
            case 5:
              ((Ie = x.stateNode), (Ut = !1));
              break e;
            case 3:
            case 4:
              ((Ie = x.stateNode.containerInfo), (Ut = !0));
              break e;
          }
          x = x.return;
        }
        if (Ie === null) throw Error(o(160));
        (wp(f, y, u),
          (Ie = null),
          (Ut = !1),
          (f = u.alternate),
          f !== null && (f.return = null),
          (u.return = null));
      }
    if (t.subtreeFlags & 13886)
      for (t = t.child; t !== null; ) (Cp(t, e), (t = t.sibling));
  }
  var mn = null;
  function Cp(e, t) {
    var r = e.alternate,
      l = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        (Lt(t, e),
          Ht(e),
          l & 4 && (Er(3, e, e.return), sl(3, e), Er(5, e, e.return)));
        break;
      case 1:
        (Lt(t, e),
          Ht(e),
          l & 512 && (ot || r === null || Tn(r, r.return)),
          l & 64 &&
            Zn &&
            ((e = e.updateQueue),
            e !== null &&
              ((l = e.callbacks),
              l !== null &&
                ((r = e.shared.hiddenCallbacks),
                (e.shared.hiddenCallbacks = r === null ? l : r.concat(l))))));
        break;
      case 26:
        var u = mn;
        if (
          (Lt(t, e),
          Ht(e),
          l & 512 && (ot || r === null || Tn(r, r.return)),
          l & 4)
        ) {
          var f = r !== null ? r.memoizedState : null;
          if (((l = e.memoizedState), r === null))
            if (l === null)
              if (e.stateNode === null) {
                e: {
                  ((l = e.type),
                    (r = e.memoizedProps),
                    (u = u.ownerDocument || u));
                  t: switch (l) {
                    case "title":
                      ((f = u.getElementsByTagName("title")[0]),
                        (!f ||
                          f[Li] ||
                          f[mt] ||
                          f.namespaceURI === "http://www.w3.org/2000/svg" ||
                          f.hasAttribute("itemprop")) &&
                          ((f = u.createElement(l)),
                          u.head.insertBefore(
                            f,
                            u.querySelector("head > title"),
                          )),
                        gt(f, l, r),
                        (f[mt] = e),
                        dt(f),
                        (l = f));
                      break e;
                    case "link":
                      var y = Cv("link", "href", u).get(l + (r.href || ""));
                      if (y) {
                        for (var x = 0; x < y.length; x++)
                          if (
                            ((f = y[x]),
                            f.getAttribute("href") ===
                              (r.href == null || r.href === ""
                                ? null
                                : r.href) &&
                              f.getAttribute("rel") ===
                                (r.rel == null ? null : r.rel) &&
                              f.getAttribute("title") ===
                                (r.title == null ? null : r.title) &&
                              f.getAttribute("crossorigin") ===
                                (r.crossOrigin == null ? null : r.crossOrigin))
                          ) {
                            y.splice(x, 1);
                            break t;
                          }
                      }
                      ((f = u.createElement(l)),
                        gt(f, l, r),
                        u.head.appendChild(f));
                      break;
                    case "meta":
                      if (
                        (y = Cv("meta", "content", u).get(
                          l + (r.content || ""),
                        ))
                      ) {
                        for (x = 0; x < y.length; x++)
                          if (
                            ((f = y[x]),
                            f.getAttribute("content") ===
                              (r.content == null ? null : "" + r.content) &&
                              f.getAttribute("name") ===
                                (r.name == null ? null : r.name) &&
                              f.getAttribute("property") ===
                                (r.property == null ? null : r.property) &&
                              f.getAttribute("http-equiv") ===
                                (r.httpEquiv == null ? null : r.httpEquiv) &&
                              f.getAttribute("charset") ===
                                (r.charSet == null ? null : r.charSet))
                          ) {
                            y.splice(x, 1);
                            break t;
                          }
                      }
                      ((f = u.createElement(l)),
                        gt(f, l, r),
                        u.head.appendChild(f));
                      break;
                    default:
                      throw Error(o(468, l));
                  }
                  ((f[mt] = e), dt(f), (l = f));
                }
                e.stateNode = l;
              } else Tv(u, e.type, e.stateNode);
            else e.stateNode = Ov(u, l, e.memoizedProps);
          else
            f !== l
              ? (f === null
                  ? r.stateNode !== null &&
                    ((r = r.stateNode), r.parentNode.removeChild(r))
                  : f.count--,
                l === null
                  ? Tv(u, e.type, e.stateNode)
                  : Ov(u, l, e.memoizedProps))
              : l === null &&
                e.stateNode !== null &&
                jc(e, e.memoizedProps, r.memoizedProps);
        }
        break;
      case 27:
        (Lt(t, e),
          Ht(e),
          l & 512 && (ot || r === null || Tn(r, r.return)),
          r !== null && l & 4 && jc(e, e.memoizedProps, r.memoizedProps));
        break;
      case 5:
        if (
          (Lt(t, e),
          Ht(e),
          l & 512 && (ot || r === null || Tn(r, r.return)),
          e.flags & 32)
        ) {
          u = e.stateNode;
          try {
            Pa(u, "");
          } catch (he) {
            Be(e, e.return, he);
          }
        }
        (l & 4 &&
          e.stateNode != null &&
          ((u = e.memoizedProps), jc(e, u, r !== null ? r.memoizedProps : u)),
          l & 1024 && (Lc = !0));
        break;
      case 6:
        if ((Lt(t, e), Ht(e), l & 4)) {
          if (e.stateNode === null) throw Error(o(162));
          ((l = e.memoizedProps), (r = e.stateNode));
          try {
            r.nodeValue = l;
          } catch (he) {
            Be(e, e.return, he);
          }
        }
        break;
      case 3:
        if (
          ((es = null),
          (u = mn),
          (mn = Jo(t.containerInfo)),
          Lt(t, e),
          (mn = u),
          Ht(e),
          l & 4 && r !== null && r.memoizedState.isDehydrated)
        )
          try {
            yi(t.containerInfo);
          } catch (he) {
            Be(e, e.return, he);
          }
        Lc && ((Lc = !1), Tp(e));
        break;
      case 4:
        ((l = mn),
          (mn = Jo(e.stateNode.containerInfo)),
          Lt(t, e),
          Ht(e),
          (mn = l));
        break;
      case 12:
        (Lt(t, e), Ht(e));
        break;
      case 31:
        (Lt(t, e),
          Ht(e),
          l & 4 &&
            ((l = e.updateQueue),
            l !== null && ((e.updateQueue = null), Bo(e, l))));
        break;
      case 13:
        (Lt(t, e),
          Ht(e),
          e.child.flags & 8192 &&
            (e.memoizedState !== null) !=
              (r !== null && r.memoizedState !== null) &&
            (Po = Tt()),
          l & 4 &&
            ((l = e.updateQueue),
            l !== null && ((e.updateQueue = null), Bo(e, l))));
        break;
      case 22:
        u = e.memoizedState !== null;
        var _ = r !== null && r.memoizedState !== null,
          H = Zn,
          X = ot;
        if (
          ((Zn = H || u),
          (ot = X || _),
          Lt(t, e),
          (ot = X),
          (Zn = H),
          Ht(e),
          l & 8192)
        )
          e: for (
            t = e.stateNode,
              t._visibility = u ? t._visibility & -2 : t._visibility | 1,
              u && (r === null || _ || Zn || ot || va(e)),
              r = null,
              t = e;
            ;
          ) {
            if (t.tag === 5 || t.tag === 26) {
              if (r === null) {
                _ = r = t;
                try {
                  if (((f = _.stateNode), u))
                    ((y = f.style),
                      typeof y.setProperty == "function"
                        ? y.setProperty("display", "none", "important")
                        : (y.display = "none"));
                  else {
                    x = _.stateNode;
                    var $ = _.memoizedProps.style,
                      P =
                        $ != null && $.hasOwnProperty("display")
                          ? $.display
                          : null;
                    x.style.display =
                      P == null || typeof P == "boolean" ? "" : ("" + P).trim();
                  }
                } catch (he) {
                  Be(_, _.return, he);
                }
              }
            } else if (t.tag === 6) {
              if (r === null) {
                _ = t;
                try {
                  _.stateNode.nodeValue = u ? "" : _.memoizedProps;
                } catch (he) {
                  Be(_, _.return, he);
                }
              }
            } else if (t.tag === 18) {
              if (r === null) {
                _ = t;
                try {
                  var Y = _.stateNode;
                  u ? pv(Y, !0) : pv(_.stateNode, !1);
                } catch (he) {
                  Be(_, _.return, he);
                }
              }
            } else if (
              ((t.tag !== 22 && t.tag !== 23) ||
                t.memoizedState === null ||
                t === e) &&
              t.child !== null
            ) {
              ((t.child.return = t), (t = t.child));
              continue;
            }
            if (t === e) break e;
            for (; t.sibling === null; ) {
              if (t.return === null || t.return === e) break e;
              (r === t && (r = null), (t = t.return));
            }
            (r === t && (r = null),
              (t.sibling.return = t.return),
              (t = t.sibling));
          }
        l & 4 &&
          ((l = e.updateQueue),
          l !== null &&
            ((r = l.retryQueue),
            r !== null && ((l.retryQueue = null), Bo(e, r))));
        break;
      case 19:
        (Lt(t, e),
          Ht(e),
          l & 4 &&
            ((l = e.updateQueue),
            l !== null && ((e.updateQueue = null), Bo(e, l))));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        (Lt(t, e), Ht(e));
    }
  }
  function Ht(e) {
    var t = e.flags;
    if (t & 2) {
      try {
        for (var r, l = e.return; l !== null; ) {
          if (yp(l)) {
            r = l;
            break;
          }
          l = l.return;
        }
        if (r == null) throw Error(o(160));
        switch (r.tag) {
          case 27:
            var u = r.stateNode,
              f = zc(e);
            Ho(e, f, u);
            break;
          case 5:
            var y = r.stateNode;
            r.flags & 32 && (Pa(y, ""), (r.flags &= -33));
            var x = zc(e);
            Ho(e, x, y);
            break;
          case 3:
          case 4:
            var _ = r.stateNode.containerInfo,
              H = zc(e);
            Uc(e, H, _);
            break;
          default:
            throw Error(o(161));
        }
      } catch (X) {
        Be(e, e.return, X);
      }
      e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
  }
  function Tp(e) {
    if (e.subtreeFlags & 1024)
      for (e = e.child; e !== null; ) {
        var t = e;
        (Tp(t),
          t.tag === 5 && t.flags & 1024 && t.stateNode.reset(),
          (e = e.sibling));
      }
  }
  function $n(e, t) {
    if (t.subtreeFlags & 8772)
      for (t = t.child; t !== null; ) (xp(e, t.alternate, t), (t = t.sibling));
  }
  function va(e) {
    for (e = e.child; e !== null; ) {
      var t = e;
      switch (t.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          (Er(4, t, t.return), va(t));
          break;
        case 1:
          Tn(t, t.return);
          var r = t.stateNode;
          (typeof r.componentWillUnmount == "function" && pp(t, t.return, r),
            va(t));
          break;
        case 27:
          gl(t.stateNode);
        case 26:
        case 5:
          (Tn(t, t.return), va(t));
          break;
        case 22:
          t.memoizedState === null && va(t);
          break;
        case 30:
          va(t);
          break;
        default:
          va(t);
      }
      e = e.sibling;
    }
  }
  function Jn(e, t, r) {
    for (r = r && (t.subtreeFlags & 8772) !== 0, t = t.child; t !== null; ) {
      var l = t.alternate,
        u = e,
        f = t,
        y = f.flags;
      switch (f.tag) {
        case 0:
        case 11:
        case 15:
          (Jn(u, f, r), sl(4, f));
          break;
        case 1:
          if (
            (Jn(u, f, r),
            (l = f),
            (u = l.stateNode),
            typeof u.componentDidMount == "function")
          )
            try {
              u.componentDidMount();
            } catch (H) {
              Be(l, l.return, H);
            }
          if (((l = f), (u = l.updateQueue), u !== null)) {
            var x = l.stateNode;
            try {
              var _ = u.shared.hiddenCallbacks;
              if (_ !== null)
                for (u.shared.hiddenCallbacks = null, u = 0; u < _.length; u++)
                  rm(_[u], x);
            } catch (H) {
              Be(l, l.return, H);
            }
          }
          (r && y & 64 && mp(f), ul(f, f.return));
          break;
        case 27:
          gp(f);
        case 26:
        case 5:
          (Jn(u, f, r), r && l === null && y & 4 && vp(f), ul(f, f.return));
          break;
        case 12:
          Jn(u, f, r);
          break;
        case 31:
          (Jn(u, f, r), r && y & 4 && Ep(u, f));
          break;
        case 13:
          (Jn(u, f, r), r && y & 4 && Op(u, f));
          break;
        case 22:
          (f.memoizedState === null && Jn(u, f, r), ul(f, f.return));
          break;
        case 30:
          break;
        default:
          Jn(u, f, r);
      }
      t = t.sibling;
    }
  }
  function Hc(e, t) {
    var r = null;
    (e !== null &&
      e.memoizedState !== null &&
      e.memoizedState.cachePool !== null &&
      (r = e.memoizedState.cachePool.pool),
      (e = null),
      t.memoizedState !== null &&
        t.memoizedState.cachePool !== null &&
        (e = t.memoizedState.cachePool.pool),
      e !== r && (e != null && e.refCount++, r != null && Zi(r)));
  }
  function Bc(e, t) {
    ((e = null),
      t.alternate !== null && (e = t.alternate.memoizedState.cache),
      (t = t.memoizedState.cache),
      t !== e && (t.refCount++, e != null && Zi(e)));
  }
  function pn(e, t, r, l) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) (_p(e, t, r, l), (t = t.sibling));
  }
  function _p(e, t, r, l) {
    var u = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        (pn(e, t, r, l), u & 2048 && sl(9, t));
        break;
      case 1:
        pn(e, t, r, l);
        break;
      case 3:
        (pn(e, t, r, l),
          u & 2048 &&
            ((e = null),
            t.alternate !== null && (e = t.alternate.memoizedState.cache),
            (t = t.memoizedState.cache),
            t !== e && (t.refCount++, e != null && Zi(e))));
        break;
      case 12:
        if (u & 2048) {
          (pn(e, t, r, l), (e = t.stateNode));
          try {
            var f = t.memoizedProps,
              y = f.id,
              x = f.onPostCommit;
            typeof x == "function" &&
              x(
                y,
                t.alternate === null ? "mount" : "update",
                e.passiveEffectDuration,
                -0,
              );
          } catch (_) {
            Be(t, t.return, _);
          }
        } else pn(e, t, r, l);
        break;
      case 31:
        pn(e, t, r, l);
        break;
      case 13:
        pn(e, t, r, l);
        break;
      case 23:
        break;
      case 22:
        ((f = t.stateNode),
          (y = t.alternate),
          t.memoizedState !== null
            ? f._visibility & 2
              ? pn(e, t, r, l)
              : cl(e, t)
            : f._visibility & 2
              ? pn(e, t, r, l)
              : ((f._visibility |= 2),
                li(e, t, r, l, (t.subtreeFlags & 10256) !== 0 || !1)),
          u & 2048 && Hc(y, t));
        break;
      case 24:
        (pn(e, t, r, l), u & 2048 && Bc(t.alternate, t));
        break;
      default:
        pn(e, t, r, l);
    }
  }
  function li(e, t, r, l, u) {
    for (
      u = u && ((t.subtreeFlags & 10256) !== 0 || !1), t = t.child;
      t !== null;
    ) {
      var f = e,
        y = t,
        x = r,
        _ = l,
        H = y.flags;
      switch (y.tag) {
        case 0:
        case 11:
        case 15:
          (li(f, y, x, _, u), sl(8, y));
          break;
        case 23:
          break;
        case 22:
          var X = y.stateNode;
          (y.memoizedState !== null
            ? X._visibility & 2
              ? li(f, y, x, _, u)
              : cl(f, y)
            : ((X._visibility |= 2), li(f, y, x, _, u)),
            u && H & 2048 && Hc(y.alternate, y));
          break;
        case 24:
          (li(f, y, x, _, u), u && H & 2048 && Bc(y.alternate, y));
          break;
        default:
          li(f, y, x, _, u);
      }
      t = t.sibling;
    }
  }
  function cl(e, t) {
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; ) {
        var r = e,
          l = t,
          u = l.flags;
        switch (l.tag) {
          case 22:
            (cl(r, l), u & 2048 && Hc(l.alternate, l));
            break;
          case 24:
            (cl(r, l), u & 2048 && Bc(l.alternate, l));
            break;
          default:
            cl(r, l);
        }
        t = t.sibling;
      }
  }
  var fl = 8192;
  function oi(e, t, r) {
    if (e.subtreeFlags & fl)
      for (e = e.child; e !== null; ) (Ap(e, t, r), (e = e.sibling));
  }
  function Ap(e, t, r) {
    switch (e.tag) {
      case 26:
        (oi(e, t, r),
          e.flags & fl &&
            e.memoizedState !== null &&
            m1(r, mn, e.memoizedState, e.memoizedProps));
        break;
      case 5:
        oi(e, t, r);
        break;
      case 3:
      case 4:
        var l = mn;
        ((mn = Jo(e.stateNode.containerInfo)), oi(e, t, r), (mn = l));
        break;
      case 22:
        e.memoizedState === null &&
          ((l = e.alternate),
          l !== null && l.memoizedState !== null
            ? ((l = fl), (fl = 16777216), oi(e, t, r), (fl = l))
            : oi(e, t, r));
        break;
      default:
        oi(e, t, r);
    }
  }
  function Rp(e) {
    var t = e.alternate;
    if (t !== null && ((e = t.child), e !== null)) {
      t.child = null;
      do ((t = e.sibling), (e.sibling = null), (e = t));
      while (e !== null);
    }
  }
  function dl(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var r = 0; r < t.length; r++) {
          var l = t[r];
          ((ht = l), Np(l, e));
        }
      Rp(e);
    }
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) (Mp(e), (e = e.sibling));
  }
  function Mp(e) {
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        (dl(e), e.flags & 2048 && Er(9, e, e.return));
        break;
      case 3:
        dl(e);
        break;
      case 12:
        dl(e);
        break;
      case 22:
        var t = e.stateNode;
        e.memoizedState !== null &&
        t._visibility & 2 &&
        (e.return === null || e.return.tag !== 13)
          ? ((t._visibility &= -3), qo(e))
          : dl(e);
        break;
      default:
        dl(e);
    }
  }
  function qo(e) {
    var t = e.deletions;
    if ((e.flags & 16) !== 0) {
      if (t !== null)
        for (var r = 0; r < t.length; r++) {
          var l = t[r];
          ((ht = l), Np(l, e));
        }
      Rp(e);
    }
    for (e = e.child; e !== null; ) {
      switch (((t = e), t.tag)) {
        case 0:
        case 11:
        case 15:
          (Er(8, t, t.return), qo(t));
          break;
        case 22:
          ((r = t.stateNode),
            r._visibility & 2 && ((r._visibility &= -3), qo(t)));
          break;
        default:
          qo(t);
      }
      e = e.sibling;
    }
  }
  function Np(e, t) {
    for (; ht !== null; ) {
      var r = ht;
      switch (r.tag) {
        case 0:
        case 11:
        case 15:
          Er(8, r, t);
          break;
        case 23:
        case 22:
          if (r.memoizedState !== null && r.memoizedState.cachePool !== null) {
            var l = r.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          Zi(r.memoizedState.cache);
      }
      if (((l = r.child), l !== null)) ((l.return = r), (ht = l));
      else
        e: for (r = e; ht !== null; ) {
          l = ht;
          var u = l.sibling,
            f = l.return;
          if ((Sp(l), l === r)) {
            ht = null;
            break e;
          }
          if (u !== null) {
            ((u.return = f), (ht = u));
            break e;
          }
          ht = f;
        }
    }
  }
  var RS = {
      getCacheForType: function (e) {
        var t = vt(at),
          r = t.data.get(e);
        return (r === void 0 && ((r = e()), t.data.set(e, r)), r);
      },
      cacheSignal: function () {
        return vt(at).controller.signal;
      },
    },
    MS = typeof WeakMap == "function" ? WeakMap : Map,
    Le = 0,
    Qe = null,
    _e = null,
    Me = 0,
    He = 0,
    Kt = null,
    Or = !1,
    si = !1,
    qc = !1,
    Wn = 0,
    $e = 0,
    Cr = 0,
    ya = 0,
    Pc = 0,
    Xt = 0,
    ui = 0,
    hl = null,
    Bt = null,
    kc = !1,
    Po = 0,
    Dp = 0,
    ko = 1 / 0,
    Qo = null,
    Tr = null,
    ut = 0,
    _r = null,
    ci = null,
    er = 0,
    Qc = 0,
    Vc = null,
    jp = null,
    ml = 0,
    Yc = null;
  function It() {
    return (Le & 2) !== 0 && Me !== 0 ? Me & -Me : A.T !== null ? Fc() : cu();
  }
  function zp() {
    if (Xt === 0)
      if ((Me & 536870912) === 0 || De) {
        var e = Da;
        ((Da <<= 1), (Da & 3932160) === 0 && (Da = 262144), (Xt = e));
      } else Xt = 536870912;
    return ((e = Yt.current), e !== null && (e.flags |= 32), Xt);
  }
  function qt(e, t, r) {
    (((e === Qe && (He === 2 || He === 9)) || e.cancelPendingCommit !== null) &&
      (fi(e, 0), Ar(e, Me, Xt, !1)),
      Ze(e, r),
      ((Le & 2) === 0 || e !== Qe) &&
        (e === Qe &&
          ((Le & 2) === 0 && (ya |= r), $e === 4 && Ar(e, Me, Xt, !1)),
        _n(e)));
  }
  function Up(e, t, r) {
    if ((Le & 6) !== 0) throw Error(o(327));
    var l = (!r && (t & 127) === 0 && (t & e.expiredLanes) === 0) || Xe(e, t),
      u = l ? jS(e, t) : Kc(e, t, !0),
      f = l;
    do {
      if (u === 0) {
        si && !l && Ar(e, t, 0, !1);
        break;
      } else {
        if (((r = e.current.alternate), f && !NS(r))) {
          ((u = Kc(e, t, !1)), (f = !1));
          continue;
        }
        if (u === 2) {
          if (((f = t), e.errorRecoveryDisabledLanes & f)) var y = 0;
          else
            ((y = e.pendingLanes & -536870913),
              (y = y !== 0 ? y : y & 536870912 ? 536870912 : 0));
          if (y !== 0) {
            t = y;
            e: {
              var x = e;
              u = hl;
              var _ = x.current.memoizedState.isDehydrated;
              if ((_ && (fi(x, y).flags |= 256), (y = Kc(x, y, !1)), y !== 2)) {
                if (qc && !_) {
                  ((x.errorRecoveryDisabledLanes |= f), (ya |= f), (u = 4));
                  break e;
                }
                ((f = Bt),
                  (Bt = u),
                  f !== null &&
                    (Bt === null ? (Bt = f) : Bt.push.apply(Bt, f)));
              }
              u = y;
            }
            if (((f = !1), u !== 2)) continue;
          }
        }
        if (u === 1) {
          (fi(e, 0), Ar(e, t, 0, !0));
          break;
        }
        e: {
          switch (((l = e), (f = u), f)) {
            case 0:
            case 1:
              throw Error(o(345));
            case 4:
              if ((t & 4194048) !== t) break;
            case 6:
              Ar(l, t, Xt, !Or);
              break e;
            case 2:
              Bt = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(o(329));
          }
          if ((t & 62914560) === t && ((u = Po + 300 - Tt()), 10 < u)) {
            if ((Ar(l, t, Xt, !Or), xe(l, 0, !0) !== 0)) break e;
            ((er = t),
              (l.timeoutHandle = dv(
                Lp.bind(
                  null,
                  l,
                  r,
                  Bt,
                  Qo,
                  kc,
                  t,
                  Xt,
                  ya,
                  ui,
                  Or,
                  f,
                  "Throttled",
                  -0,
                  0,
                ),
                u,
              )));
            break e;
          }
          Lp(l, r, Bt, Qo, kc, t, Xt, ya, ui, Or, f, null, -0, 0);
        }
      }
      break;
    } while (!0);
    _n(e);
  }
  function Lp(e, t, r, l, u, f, y, x, _, H, X, $, P, Y) {
    if (
      ((e.timeoutHandle = -1),
      ($ = t.subtreeFlags),
      $ & 8192 || ($ & 16785408) === 16785408)
    ) {
      (($ = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: qn,
      }),
        Ap(t, f, $));
      var he =
        (f & 62914560) === f ? Po - Tt() : (f & 4194048) === f ? Dp - Tt() : 0;
      if (((he = p1($, he)), he !== null)) {
        ((er = f),
          (e.cancelPendingCommit = he(
            Yp.bind(null, e, t, f, r, l, u, y, x, _, X, $, null, P, Y),
          )),
          Ar(e, f, y, !H));
        return;
      }
    }
    Yp(e, t, f, r, l, u, y, x, _);
  }
  function NS(e) {
    for (var t = e; ; ) {
      var r = t.tag;
      if (
        (r === 0 || r === 11 || r === 15) &&
        t.flags & 16384 &&
        ((r = t.updateQueue), r !== null && ((r = r.stores), r !== null))
      )
        for (var l = 0; l < r.length; l++) {
          var u = r[l],
            f = u.getSnapshot;
          u = u.value;
          try {
            if (!Qt(f(), u)) return !1;
          } catch {
            return !1;
          }
        }
      if (((r = t.child), t.subtreeFlags & 16384 && r !== null))
        ((r.return = t), (t = r));
      else {
        if (t === e) break;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e) return !0;
          t = t.return;
        }
        ((t.sibling.return = t.return), (t = t.sibling));
      }
    }
    return !0;
  }
  function Ar(e, t, r, l) {
    ((t &= ~Pc),
      (t &= ~ya),
      (e.suspendedLanes |= t),
      (e.pingedLanes &= ~t),
      l && (e.warmLanes |= t),
      (l = e.expirationTimes));
    for (var u = t; 0 < u; ) {
      var f = 31 - bt(u),
        y = 1 << f;
      ((l[f] = -1), (u &= ~y));
    }
    r !== 0 && ea(e, r, t);
  }
  function Vo() {
    return (Le & 6) === 0 ? (pl(0), !1) : !0;
  }
  function Gc() {
    if (_e !== null) {
      if (He === 0) var e = _e.return;
      else ((e = _e), (Vn = sa = null), oc(e), (ti = null), ($i = 0), (e = _e));
      for (; e !== null; ) (hp(e.alternate, e), (e = e.return));
      _e = null;
    }
  }
  function fi(e, t) {
    var r = e.timeoutHandle;
    (r !== -1 && ((e.timeoutHandle = -1), $S(r)),
      (r = e.cancelPendingCommit),
      r !== null && ((e.cancelPendingCommit = null), r()),
      (er = 0),
      Gc(),
      (Qe = e),
      (_e = r = kn(e.current, null)),
      (Me = t),
      (He = 0),
      (Kt = null),
      (Or = !1),
      (si = Xe(e, t)),
      (qc = !1),
      (ui = Xt = Pc = ya = Cr = $e = 0),
      (Bt = hl = null),
      (kc = !1),
      (t & 8) !== 0 && (t |= t & 32));
    var l = e.entangledLanes;
    if (l !== 0)
      for (e = e.entanglements, l &= t; 0 < l; ) {
        var u = 31 - bt(l),
          f = 1 << u;
        ((t |= e[u]), (l &= ~f));
      }
    return ((Wn = t), uo(), r);
  }
  function Hp(e, t) {
    ((we = null),
      (A.H = il),
      t === ei || t === go
        ? ((t = Wh()), (He = 3))
        : t === Zu
          ? ((t = Wh()), (He = 4))
          : (He =
              t === Ec
                ? 8
                : t !== null &&
                    typeof t == "object" &&
                    typeof t.then == "function"
                  ? 6
                  : 1),
      (Kt = t),
      _e === null && (($e = 1), Do(e, tn(t, e.current))));
  }
  function Bp() {
    var e = Yt.current;
    return e === null
      ? !0
      : (Me & 4194048) === Me
        ? ln === null
        : (Me & 62914560) === Me || (Me & 536870912) !== 0
          ? e === ln
          : !1;
  }
  function qp() {
    var e = A.H;
    return ((A.H = il), e === null ? il : e);
  }
  function Pp() {
    var e = A.A;
    return ((A.A = RS), e);
  }
  function Yo() {
    (($e = 4),
      Or || ((Me & 4194048) !== Me && Yt.current !== null) || (si = !0),
      ((Cr & 134217727) === 0 && (ya & 134217727) === 0) ||
        Qe === null ||
        Ar(Qe, Me, Xt, !1));
  }
  function Kc(e, t, r) {
    var l = Le;
    Le |= 2;
    var u = qp(),
      f = Pp();
    ((Qe !== e || Me !== t) && ((Qo = null), fi(e, t)), (t = !1));
    var y = $e;
    e: do
      try {
        if (He !== 0 && _e !== null) {
          var x = _e,
            _ = Kt;
          switch (He) {
            case 8:
              (Gc(), (y = 6));
              break e;
            case 3:
            case 2:
            case 9:
            case 6:
              Yt.current === null && (t = !0);
              var H = He;
              if (((He = 0), (Kt = null), di(e, x, _, H), r && si)) {
                y = 0;
                break e;
              }
              break;
            default:
              ((H = He), (He = 0), (Kt = null), di(e, x, _, H));
          }
        }
        (DS(), (y = $e));
        break;
      } catch (X) {
        Hp(e, X);
      }
    while (!0);
    return (
      t && e.shellSuspendCounter++,
      (Vn = sa = null),
      (Le = l),
      (A.H = u),
      (A.A = f),
      _e === null && ((Qe = null), (Me = 0), uo()),
      y
    );
  }
  function DS() {
    for (; _e !== null; ) kp(_e);
  }
  function jS(e, t) {
    var r = Le;
    Le |= 2;
    var l = qp(),
      u = Pp();
    Qe !== e || Me !== t
      ? ((Qo = null), (ko = Tt() + 500), fi(e, t))
      : (si = Xe(e, t));
    e: do
      try {
        if (He !== 0 && _e !== null) {
          t = _e;
          var f = Kt;
          t: switch (He) {
            case 1:
              ((He = 0), (Kt = null), di(e, t, f, 1));
              break;
            case 2:
            case 9:
              if ($h(f)) {
                ((He = 0), (Kt = null), Qp(t));
                break;
              }
              ((t = function () {
                ((He !== 2 && He !== 9) || Qe !== e || (He = 7), _n(e));
              }),
                f.then(t, t));
              break e;
            case 3:
              He = 7;
              break e;
            case 4:
              He = 5;
              break e;
            case 7:
              $h(f)
                ? ((He = 0), (Kt = null), Qp(t))
                : ((He = 0), (Kt = null), di(e, t, f, 7));
              break;
            case 5:
              var y = null;
              switch (_e.tag) {
                case 26:
                  y = _e.memoizedState;
                case 5:
                case 27:
                  var x = _e;
                  if (y ? _v(y) : x.stateNode.complete) {
                    ((He = 0), (Kt = null));
                    var _ = x.sibling;
                    if (_ !== null) _e = _;
                    else {
                      var H = x.return;
                      H !== null ? ((_e = H), Go(H)) : (_e = null);
                    }
                    break t;
                  }
              }
              ((He = 0), (Kt = null), di(e, t, f, 5));
              break;
            case 6:
              ((He = 0), (Kt = null), di(e, t, f, 6));
              break;
            case 8:
              (Gc(), ($e = 6));
              break e;
            default:
              throw Error(o(462));
          }
        }
        zS();
        break;
      } catch (X) {
        Hp(e, X);
      }
    while (!0);
    return (
      (Vn = sa = null),
      (A.H = l),
      (A.A = u),
      (Le = r),
      _e !== null ? 0 : ((Qe = null), (Me = 0), uo(), $e)
    );
  }
  function zS() {
    for (; _e !== null && !Ct(); ) kp(_e);
  }
  function kp(e) {
    var t = fp(e.alternate, e, Wn);
    ((e.memoizedProps = e.pendingProps), t === null ? Go(e) : (_e = t));
  }
  function Qp(e) {
    var t = e,
      r = t.alternate;
    switch (t.tag) {
      case 15:
      case 0:
        t = ip(r, t, t.pendingProps, t.type, void 0, Me);
        break;
      case 11:
        t = ip(r, t, t.pendingProps, t.type.render, t.ref, Me);
        break;
      case 5:
        oc(t);
      default:
        (hp(r, t), (t = _e = Ph(t, Wn)), (t = fp(r, t, Wn)));
    }
    ((e.memoizedProps = e.pendingProps), t === null ? Go(e) : (_e = t));
  }
  function di(e, t, r, l) {
    ((Vn = sa = null), oc(t), (ti = null), ($i = 0));
    var u = t.return;
    try {
      if (wS(e, u, t, r, Me)) {
        (($e = 1), Do(e, tn(r, e.current)), (_e = null));
        return;
      }
    } catch (f) {
      if (u !== null) throw ((_e = u), f);
      (($e = 1), Do(e, tn(r, e.current)), (_e = null));
      return;
    }
    t.flags & 32768
      ? (De || l === 1
          ? (e = !0)
          : si || (Me & 536870912) !== 0
            ? (e = !1)
            : ((Or = e = !0),
              (l === 2 || l === 9 || l === 3 || l === 6) &&
                ((l = Yt.current),
                l !== null && l.tag === 13 && (l.flags |= 16384))),
        Vp(t, e))
      : Go(t);
  }
  function Go(e) {
    var t = e;
    do {
      if ((t.flags & 32768) !== 0) {
        Vp(t, Or);
        return;
      }
      e = t.return;
      var r = CS(t.alternate, t, Wn);
      if (r !== null) {
        _e = r;
        return;
      }
      if (((t = t.sibling), t !== null)) {
        _e = t;
        return;
      }
      _e = t = e;
    } while (t !== null);
    $e === 0 && ($e = 5);
  }
  function Vp(e, t) {
    do {
      var r = TS(e.alternate, e);
      if (r !== null) {
        ((r.flags &= 32767), (_e = r));
        return;
      }
      if (
        ((r = e.return),
        r !== null &&
          ((r.flags |= 32768), (r.subtreeFlags = 0), (r.deletions = null)),
        !t && ((e = e.sibling), e !== null))
      ) {
        _e = e;
        return;
      }
      _e = e = r;
    } while (e !== null);
    (($e = 6), (_e = null));
  }
  function Yp(e, t, r, l, u, f, y, x, _) {
    e.cancelPendingCommit = null;
    do Ko();
    while (ut !== 0);
    if ((Le & 6) !== 0) throw Error(o(327));
    if (t !== null) {
      if (t === e.current) throw Error(o(177));
      if (
        ((f = t.lanes | t.childLanes),
        (f |= zu),
        Mt(e, r, f, y, x, _),
        e === Qe && ((_e = Qe = null), (Me = 0)),
        (ci = t),
        (_r = e),
        (er = r),
        (Qc = f),
        (Vc = u),
        (jp = l),
        (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0
          ? ((e.callbackNode = null),
            (e.callbackPriority = 0),
            BS($r, function () {
              return (Zp(), null);
            }))
          : ((e.callbackNode = null), (e.callbackPriority = 0)),
        (l = (t.flags & 13878) !== 0),
        (t.subtreeFlags & 13878) !== 0 || l)
      ) {
        ((l = A.T), (A.T = null), (u = B.p), (B.p = 2), (y = Le), (Le |= 4));
        try {
          _S(e, t, r);
        } finally {
          ((Le = y), (B.p = u), (A.T = l));
        }
      }
      ((ut = 1), Gp(), Kp(), Xp());
    }
  }
  function Gp() {
    if (ut === 1) {
      ut = 0;
      var e = _r,
        t = ci,
        r = (t.flags & 13878) !== 0;
      if ((t.subtreeFlags & 13878) !== 0 || r) {
        ((r = A.T), (A.T = null));
        var l = B.p;
        B.p = 2;
        var u = Le;
        Le |= 4;
        try {
          Cp(t, e);
          var f = af,
            y = Nh(e.containerInfo),
            x = f.focusedElem,
            _ = f.selectionRange;
          if (
            y !== x &&
            x &&
            x.ownerDocument &&
            Mh(x.ownerDocument.documentElement, x)
          ) {
            if (_ !== null && Ru(x)) {
              var H = _.start,
                X = _.end;
              if ((X === void 0 && (X = H), "selectionStart" in x))
                ((x.selectionStart = H),
                  (x.selectionEnd = Math.min(X, x.value.length)));
              else {
                var $ = x.ownerDocument || document,
                  P = ($ && $.defaultView) || window;
                if (P.getSelection) {
                  var Y = P.getSelection(),
                    he = x.textContent.length,
                    be = Math.min(_.start, he),
                    ke = _.end === void 0 ? be : Math.min(_.end, he);
                  !Y.extend && be > ke && ((y = ke), (ke = be), (be = y));
                  var z = Rh(x, be),
                    D = Rh(x, ke);
                  if (
                    z &&
                    D &&
                    (Y.rangeCount !== 1 ||
                      Y.anchorNode !== z.node ||
                      Y.anchorOffset !== z.offset ||
                      Y.focusNode !== D.node ||
                      Y.focusOffset !== D.offset)
                  ) {
                    var L = $.createRange();
                    (L.setStart(z.node, z.offset),
                      Y.removeAllRanges(),
                      be > ke
                        ? (Y.addRange(L), Y.extend(D.node, D.offset))
                        : (L.setEnd(D.node, D.offset), Y.addRange(L)));
                  }
                }
              }
            }
            for ($ = [], Y = x; (Y = Y.parentNode); )
              Y.nodeType === 1 &&
                $.push({ element: Y, left: Y.scrollLeft, top: Y.scrollTop });
            for (
              typeof x.focus == "function" && x.focus(), x = 0;
              x < $.length;
              x++
            ) {
              var F = $[x];
              ((F.element.scrollLeft = F.left), (F.element.scrollTop = F.top));
            }
          }
          ((as = !!rf), (af = rf = null));
        } finally {
          ((Le = u), (B.p = l), (A.T = r));
        }
      }
      ((e.current = t), (ut = 2));
    }
  }
  function Kp() {
    if (ut === 2) {
      ut = 0;
      var e = _r,
        t = ci,
        r = (t.flags & 8772) !== 0;
      if ((t.subtreeFlags & 8772) !== 0 || r) {
        ((r = A.T), (A.T = null));
        var l = B.p;
        B.p = 2;
        var u = Le;
        Le |= 4;
        try {
          xp(e, t.alternate, t);
        } finally {
          ((Le = u), (B.p = l), (A.T = r));
        }
      }
      ut = 3;
    }
  }
  function Xp() {
    if (ut === 4 || ut === 3) {
      ((ut = 0), ur());
      var e = _r,
        t = ci,
        r = er,
        l = jp;
      (t.subtreeFlags & 10256) !== 0 || (t.flags & 10256) !== 0
        ? (ut = 5)
        : ((ut = 0), (ci = _r = null), Ip(e, e.pendingLanes));
      var u = e.pendingLanes;
      if (
        (u === 0 && (Tr = null),
        dn(r),
        (t = t.stateNode),
        _t && typeof _t.onCommitFiberRoot == "function")
      )
        try {
          _t.onCommitFiberRoot(Jr, t, void 0, (t.current.flags & 128) === 128);
        } catch {}
      if (l !== null) {
        ((t = A.T), (u = B.p), (B.p = 2), (A.T = null));
        try {
          for (var f = e.onRecoverableError, y = 0; y < l.length; y++) {
            var x = l[y];
            f(x.value, { componentStack: x.stack });
          }
        } finally {
          ((A.T = t), (B.p = u));
        }
      }
      ((er & 3) !== 0 && Ko(),
        _n(e),
        (u = e.pendingLanes),
        (r & 261930) !== 0 && (u & 42) !== 0
          ? e === Yc
            ? ml++
            : ((ml = 0), (Yc = e))
          : (ml = 0),
        pl(0));
    }
  }
  function Ip(e, t) {
    (e.pooledCacheLanes &= t) === 0 &&
      ((t = e.pooledCache), t != null && ((e.pooledCache = null), Zi(t)));
  }
  function Ko() {
    return (Gp(), Kp(), Xp(), Zp());
  }
  function Zp() {
    if (ut !== 5) return !1;
    var e = _r,
      t = Qc;
    Qc = 0;
    var r = dn(er),
      l = A.T,
      u = B.p;
    try {
      ((B.p = 32 > r ? 32 : r), (A.T = null), (r = Vc), (Vc = null));
      var f = _r,
        y = er;
      if (((ut = 0), (ci = _r = null), (er = 0), (Le & 6) !== 0))
        throw Error(o(331));
      var x = Le;
      if (
        ((Le |= 4),
        Mp(f.current),
        _p(f, f.current, y, r),
        (Le = x),
        pl(0, !1),
        _t && typeof _t.onPostCommitFiberRoot == "function")
      )
        try {
          _t.onPostCommitFiberRoot(Jr, f);
        } catch {}
      return !0;
    } finally {
      ((B.p = u), (A.T = l), Ip(e, t));
    }
  }
  function Fp(e, t, r) {
    ((t = tn(r, t)),
      (t = wc(e.stateNode, t, 2)),
      (e = xr(e, t, 2)),
      e !== null && (Ze(e, 2), _n(e)));
  }
  function Be(e, t, r) {
    if (e.tag === 3) Fp(e, e, r);
    else
      for (; t !== null; ) {
        if (t.tag === 3) {
          Fp(t, e, r);
          break;
        } else if (t.tag === 1) {
          var l = t.stateNode;
          if (
            typeof t.type.getDerivedStateFromError == "function" ||
            (typeof l.componentDidCatch == "function" &&
              (Tr === null || !Tr.has(l)))
          ) {
            ((e = tn(r, e)),
              (r = $m(2)),
              (l = xr(t, r, 2)),
              l !== null && (Jm(r, l, t, e), Ze(l, 2), _n(l)));
            break;
          }
        }
        t = t.return;
      }
  }
  function Xc(e, t, r) {
    var l = e.pingCache;
    if (l === null) {
      l = e.pingCache = new MS();
      var u = new Set();
      l.set(t, u);
    } else ((u = l.get(t)), u === void 0 && ((u = new Set()), l.set(t, u)));
    u.has(r) ||
      ((qc = !0), u.add(r), (e = US.bind(null, e, t, r)), t.then(e, e));
  }
  function US(e, t, r) {
    var l = e.pingCache;
    (l !== null && l.delete(t),
      (e.pingedLanes |= e.suspendedLanes & r),
      (e.warmLanes &= ~r),
      Qe === e &&
        (Me & r) === r &&
        ($e === 4 || ($e === 3 && (Me & 62914560) === Me && 300 > Tt() - Po)
          ? (Le & 2) === 0 && fi(e, 0)
          : (Pc |= r),
        ui === Me && (ui = 0)),
      _n(e));
  }
  function $p(e, t) {
    (t === 0 && (t = xt()), (e = ia(e, t)), e !== null && (Ze(e, t), _n(e)));
  }
  function LS(e) {
    var t = e.memoizedState,
      r = 0;
    (t !== null && (r = t.retryLane), $p(e, r));
  }
  function HS(e, t) {
    var r = 0;
    switch (e.tag) {
      case 31:
      case 13:
        var l = e.stateNode,
          u = e.memoizedState;
        u !== null && (r = u.retryLane);
        break;
      case 19:
        l = e.stateNode;
        break;
      case 22:
        l = e.stateNode._retryCache;
        break;
      default:
        throw Error(o(314));
    }
    (l !== null && l.delete(t), $p(e, r));
  }
  function BS(e, t) {
    return Di(e, t);
  }
  var Xo = null,
    hi = null,
    Ic = !1,
    Io = !1,
    Zc = !1,
    Rr = 0;
  function _n(e) {
    (e !== hi &&
      e.next === null &&
      (hi === null ? (Xo = hi = e) : (hi = hi.next = e)),
      (Io = !0),
      Ic || ((Ic = !0), PS()));
  }
  function pl(e, t) {
    if (!Zc && Io) {
      Zc = !0;
      do
        for (var r = !1, l = Xo; l !== null; ) {
          if (e !== 0) {
            var u = l.pendingLanes;
            if (u === 0) var f = 0;
            else {
              var y = l.suspendedLanes,
                x = l.pingedLanes;
              ((f = (1 << (31 - bt(42 | e) + 1)) - 1),
                (f &= u & ~(y & ~x)),
                (f = f & 201326741 ? (f & 201326741) | 1 : f ? f | 2 : 0));
            }
            f !== 0 && ((r = !0), tv(l, f));
          } else
            ((f = Me),
              (f = xe(
                l,
                l === Qe ? f : 0,
                l.cancelPendingCommit !== null || l.timeoutHandle !== -1,
              )),
              (f & 3) === 0 || Xe(l, f) || ((r = !0), tv(l, f)));
          l = l.next;
        }
      while (r);
      Zc = !1;
    }
  }
  function qS() {
    Jp();
  }
  function Jp() {
    Io = Ic = !1;
    var e = 0;
    Rr !== 0 && FS() && (e = Rr);
    for (var t = Tt(), r = null, l = Xo; l !== null; ) {
      var u = l.next,
        f = Wp(l, t);
      (f === 0
        ? ((l.next = null),
          r === null ? (Xo = u) : (r.next = u),
          u === null && (hi = r))
        : ((r = l), (e !== 0 || (f & 3) !== 0) && (Io = !0)),
        (l = u));
    }
    ((ut !== 0 && ut !== 5) || pl(e), Rr !== 0 && (Rr = 0));
  }
  function Wp(e, t) {
    for (
      var r = e.suspendedLanes,
        l = e.pingedLanes,
        u = e.expirationTimes,
        f = e.pendingLanes & -62914561;
      0 < f;
    ) {
      var y = 31 - bt(f),
        x = 1 << y,
        _ = u[y];
      (_ === -1
        ? ((x & r) === 0 || (x & l) !== 0) && (u[y] = ft(x, t))
        : _ <= t && (e.expiredLanes |= x),
        (f &= ~x));
    }
    if (
      ((t = Qe),
      (r = Me),
      (r = xe(
        e,
        e === t ? r : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== -1,
      )),
      (l = e.callbackNode),
      r === 0 ||
        (e === t && (He === 2 || He === 9)) ||
        e.cancelPendingCommit !== null)
    )
      return (
        l !== null && l !== null && ji(l),
        (e.callbackNode = null),
        (e.callbackPriority = 0)
      );
    if ((r & 3) === 0 || Xe(e, r)) {
      if (((t = r & -r), t === e.callbackPriority)) return t;
      switch ((l !== null && ji(l), dn(r))) {
        case 2:
        case 8:
          r = Fl;
          break;
        case 32:
          r = $r;
          break;
        case 268435456:
          r = Hn;
          break;
        default:
          r = $r;
      }
      return (
        (l = ev.bind(null, e)),
        (r = Di(r, l)),
        (e.callbackPriority = t),
        (e.callbackNode = r),
        t
      );
    }
    return (
      l !== null && l !== null && ji(l),
      (e.callbackPriority = 2),
      (e.callbackNode = null),
      2
    );
  }
  function ev(e, t) {
    if (ut !== 0 && ut !== 5)
      return ((e.callbackNode = null), (e.callbackPriority = 0), null);
    var r = e.callbackNode;
    if (Ko() && e.callbackNode !== r) return null;
    var l = Me;
    return (
      (l = xe(
        e,
        e === Qe ? l : 0,
        e.cancelPendingCommit !== null || e.timeoutHandle !== -1,
      )),
      l === 0
        ? null
        : (Up(e, l, t),
          Wp(e, Tt()),
          e.callbackNode != null && e.callbackNode === r
            ? ev.bind(null, e)
            : null)
    );
  }
  function tv(e, t) {
    if (Ko()) return null;
    Up(e, t, !0);
  }
  function PS() {
    JS(function () {
      (Le & 6) !== 0 ? Di(Fr, qS) : Jp();
    });
  }
  function Fc() {
    if (Rr === 0) {
      var e = Ja;
      (e === 0 && ((e = Na), (Na <<= 1), (Na & 261888) === 0 && (Na = 256)),
        (Rr = e));
    }
    return Rr;
  }
  function nv(e) {
    return e == null || typeof e == "symbol" || typeof e == "boolean"
      ? null
      : typeof e == "function"
        ? e
        : to("" + e);
  }
  function rv(e, t) {
    var r = t.ownerDocument.createElement("input");
    return (
      (r.name = t.name),
      (r.value = t.value),
      e.id && r.setAttribute("form", e.id),
      t.parentNode.insertBefore(r, t),
      (e = new FormData(e)),
      r.parentNode.removeChild(r),
      e
    );
  }
  function kS(e, t, r, l, u) {
    if (t === "submit" && r && r.stateNode === u) {
      var f = nv((u[jt] || null).action),
        y = l.submitter;
      y &&
        ((t = (t = y[jt] || null)
          ? nv(t.formAction)
          : y.getAttribute("formAction")),
        t !== null && ((f = t), (y = null)));
      var x = new io("action", "action", null, l, u);
      e.push({
        event: x,
        listeners: [
          {
            instance: null,
            listener: function () {
              if (l.defaultPrevented) {
                if (Rr !== 0) {
                  var _ = y ? rv(u, y) : new FormData(u);
                  vc(
                    r,
                    { pending: !0, data: _, method: u.method, action: f },
                    null,
                    _,
                  );
                }
              } else
                typeof f == "function" &&
                  (x.preventDefault(),
                  (_ = y ? rv(u, y) : new FormData(u)),
                  vc(
                    r,
                    { pending: !0, data: _, method: u.method, action: f },
                    f,
                    _,
                  ));
            },
            currentTarget: u,
          },
        ],
      });
    }
  }
  for (var $c = 0; $c < ju.length; $c++) {
    var Jc = ju[$c],
      QS = Jc.toLowerCase(),
      VS = Jc[0].toUpperCase() + Jc.slice(1);
    hn(QS, "on" + VS);
  }
  (hn(zh, "onAnimationEnd"),
    hn(Uh, "onAnimationIteration"),
    hn(Lh, "onAnimationStart"),
    hn("dblclick", "onDoubleClick"),
    hn("focusin", "onFocus"),
    hn("focusout", "onBlur"),
    hn(iS, "onTransitionRun"),
    hn(lS, "onTransitionStart"),
    hn(oS, "onTransitionCancel"),
    hn(Hh, "onTransitionEnd"),
    Ba("onMouseEnter", ["mouseout", "mouseover"]),
    Ba("onMouseLeave", ["mouseout", "mouseover"]),
    Ba("onPointerEnter", ["pointerout", "pointerover"]),
    Ba("onPointerLeave", ["pointerout", "pointerover"]),
    ta(
      "onChange",
      "change click focusin focusout input keydown keyup selectionchange".split(
        " ",
      ),
    ),
    ta(
      "onSelect",
      "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
        " ",
      ),
    ),
    ta("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]),
    ta(
      "onCompositionEnd",
      "compositionend focusout keydown keypress keyup mousedown".split(" "),
    ),
    ta(
      "onCompositionStart",
      "compositionstart focusout keydown keypress keyup mousedown".split(" "),
    ),
    ta(
      "onCompositionUpdate",
      "compositionupdate focusout keydown keypress keyup mousedown".split(" "),
    ));
  var vl =
      "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
        " ",
      ),
    YS = new Set(
      "beforetoggle cancel close invalid load scroll scrollend toggle"
        .split(" ")
        .concat(vl),
    );
  function av(e, t) {
    t = (t & 4) !== 0;
    for (var r = 0; r < e.length; r++) {
      var l = e[r],
        u = l.event;
      l = l.listeners;
      e: {
        var f = void 0;
        if (t)
          for (var y = l.length - 1; 0 <= y; y--) {
            var x = l[y],
              _ = x.instance,
              H = x.currentTarget;
            if (((x = x.listener), _ !== f && u.isPropagationStopped()))
              break e;
            ((f = x), (u.currentTarget = H));
            try {
              f(u);
            } catch (X) {
              so(X);
            }
            ((u.currentTarget = null), (f = _));
          }
        else
          for (y = 0; y < l.length; y++) {
            if (
              ((x = l[y]),
              (_ = x.instance),
              (H = x.currentTarget),
              (x = x.listener),
              _ !== f && u.isPropagationStopped())
            )
              break e;
            ((f = x), (u.currentTarget = H));
            try {
              f(u);
            } catch (X) {
              so(X);
            }
            ((u.currentTarget = null), (f = _));
          }
      }
    }
  }
  function Ae(e, t) {
    var r = t[fu];
    r === void 0 && (r = t[fu] = new Set());
    var l = e + "__bubble";
    r.has(l) || (iv(t, e, 2, !1), r.add(l));
  }
  function Wc(e, t, r) {
    var l = 0;
    (t && (l |= 4), iv(r, e, l, t));
  }
  var Zo = "_reactListening" + Math.random().toString(36).slice(2);
  function ef(e) {
    if (!e[Zo]) {
      ((e[Zo] = !0),
        Jd.forEach(function (r) {
          r !== "selectionchange" && (YS.has(r) || Wc(r, !1, e), Wc(r, !0, e));
        }));
      var t = e.nodeType === 9 ? e : e.ownerDocument;
      t === null || t[Zo] || ((t[Zo] = !0), Wc("selectionchange", !1, t));
    }
  }
  function iv(e, t, r, l) {
    switch (zv(t)) {
      case 2:
        var u = g1;
        break;
      case 8:
        u = b1;
        break;
      default:
        u = vf;
    }
    ((r = u.bind(null, t, r, e)),
      (u = void 0),
      !xu ||
        (t !== "touchstart" && t !== "touchmove" && t !== "wheel") ||
        (u = !0),
      l
        ? u !== void 0
          ? e.addEventListener(t, r, { capture: !0, passive: u })
          : e.addEventListener(t, r, !0)
        : u !== void 0
          ? e.addEventListener(t, r, { passive: u })
          : e.addEventListener(t, r, !1));
  }
  function tf(e, t, r, l, u) {
    var f = l;
    if ((t & 1) === 0 && (t & 2) === 0 && l !== null)
      e: for (;;) {
        if (l === null) return;
        var y = l.tag;
        if (y === 3 || y === 4) {
          var x = l.stateNode.containerInfo;
          if (x === u) break;
          if (y === 4)
            for (y = l.return; y !== null; ) {
              var _ = y.tag;
              if ((_ === 3 || _ === 4) && y.stateNode.containerInfo === u)
                return;
              y = y.return;
            }
          for (; x !== null; ) {
            if (((y = Ua(x)), y === null)) return;
            if (((_ = y.tag), _ === 5 || _ === 6 || _ === 26 || _ === 27)) {
              l = f = y;
              continue e;
            }
            x = x.parentNode;
          }
        }
        l = l.return;
      }
    ch(function () {
      var H = f,
        X = gu(r),
        $ = [];
      e: {
        var P = Bh.get(e);
        if (P !== void 0) {
          var Y = io,
            he = e;
          switch (e) {
            case "keypress":
              if (ro(r) === 0) break e;
            case "keydown":
            case "keyup":
              Y = Hx;
              break;
            case "focusin":
              ((he = "focus"), (Y = Ou));
              break;
            case "focusout":
              ((he = "blur"), (Y = Ou));
              break;
            case "beforeblur":
            case "afterblur":
              Y = Ou;
              break;
            case "click":
              if (r.button === 2) break e;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              Y = hh;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              Y = Cx;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              Y = Px;
              break;
            case zh:
            case Uh:
            case Lh:
              Y = Ax;
              break;
            case Hh:
              Y = Qx;
              break;
            case "scroll":
            case "scrollend":
              Y = Ex;
              break;
            case "wheel":
              Y = Yx;
              break;
            case "copy":
            case "cut":
            case "paste":
              Y = Mx;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              Y = ph;
              break;
            case "toggle":
            case "beforetoggle":
              Y = Kx;
          }
          var be = (t & 4) !== 0,
            ke = !be && (e === "scroll" || e === "scrollend"),
            z = be ? (P !== null ? P + "Capture" : null) : P;
          be = [];
          for (var D = H, L; D !== null; ) {
            var F = D;
            if (
              ((L = F.stateNode),
              (F = F.tag),
              (F !== 5 && F !== 26 && F !== 27) ||
                L === null ||
                z === null ||
                ((F = Bi(D, z)), F != null && be.push(yl(D, F, L))),
              ke)
            )
              break;
            D = D.return;
          }
          0 < be.length &&
            ((P = new Y(P, he, null, r, X)),
            $.push({ event: P, listeners: be }));
        }
      }
      if ((t & 7) === 0) {
        e: {
          if (
            ((P = e === "mouseover" || e === "pointerover"),
            (Y = e === "mouseout" || e === "pointerout"),
            P &&
              r !== yu &&
              (he = r.relatedTarget || r.fromElement) &&
              (Ua(he) || he[za]))
          )
            break e;
          if (
            (Y || P) &&
            ((P =
              X.window === X
                ? X
                : (P = X.ownerDocument)
                  ? P.defaultView || P.parentWindow
                  : window),
            Y
              ? ((he = r.relatedTarget || r.toElement),
                (Y = H),
                (he = he ? Ua(he) : null),
                he !== null &&
                  ((ke = c(he)),
                  (be = he.tag),
                  he !== ke || (be !== 5 && be !== 27 && be !== 6)) &&
                  (he = null))
              : ((Y = null), (he = H)),
            Y !== he)
          ) {
            if (
              ((be = hh),
              (F = "onMouseLeave"),
              (z = "onMouseEnter"),
              (D = "mouse"),
              (e === "pointerout" || e === "pointerover") &&
                ((be = ph),
                (F = "onPointerLeave"),
                (z = "onPointerEnter"),
                (D = "pointer")),
              (ke = Y == null ? P : Hi(Y)),
              (L = he == null ? P : Hi(he)),
              (P = new be(F, D + "leave", Y, r, X)),
              (P.target = ke),
              (P.relatedTarget = L),
              (F = null),
              Ua(X) === H &&
                ((be = new be(z, D + "enter", he, r, X)),
                (be.target = L),
                (be.relatedTarget = ke),
                (F = be)),
              (ke = F),
              Y && he)
            )
              t: {
                for (be = GS, z = Y, D = he, L = 0, F = z; F; F = be(F)) L++;
                F = 0;
                for (var ge = D; ge; ge = be(ge)) F++;
                for (; 0 < L - F; ) ((z = be(z)), L--);
                for (; 0 < F - L; ) ((D = be(D)), F--);
                for (; L--; ) {
                  if (z === D || (D !== null && z === D.alternate)) {
                    be = z;
                    break t;
                  }
                  ((z = be(z)), (D = be(D)));
                }
                be = null;
              }
            else be = null;
            (Y !== null && lv($, P, Y, be, !1),
              he !== null && ke !== null && lv($, ke, he, be, !0));
          }
        }
        e: {
          if (
            ((P = H ? Hi(H) : window),
            (Y = P.nodeName && P.nodeName.toLowerCase()),
            Y === "select" || (Y === "input" && P.type === "file"))
          )
            var je = Eh;
          else if (Sh(P))
            if (Oh) je = nS;
            else {
              je = eS;
              var ye = Wx;
            }
          else
            ((Y = P.nodeName),
              !Y ||
              Y.toLowerCase() !== "input" ||
              (P.type !== "checkbox" && P.type !== "radio")
                ? H && vu(H.elementType) && (je = Eh)
                : (je = tS));
          if (je && (je = je(e, H))) {
            wh($, je, r, X);
            break e;
          }
          (ye && ye(e, P, H),
            e === "focusout" &&
              H &&
              P.type === "number" &&
              H.memoizedProps.value != null &&
              pu(P, "number", P.value));
        }
        switch (((ye = H ? Hi(H) : window), e)) {
          case "focusin":
            (Sh(ye) || ye.contentEditable === "true") &&
              ((Ya = ye), (Mu = H), (Ki = null));
            break;
          case "focusout":
            Ki = Mu = Ya = null;
            break;
          case "mousedown":
            Nu = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            ((Nu = !1), Dh($, r, X));
            break;
          case "selectionchange":
            if (aS) break;
          case "keydown":
          case "keyup":
            Dh($, r, X);
        }
        var Ee;
        if (Tu)
          e: {
            switch (e) {
              case "compositionstart":
                var Ne = "onCompositionStart";
                break e;
              case "compositionend":
                Ne = "onCompositionEnd";
                break e;
              case "compositionupdate":
                Ne = "onCompositionUpdate";
                break e;
            }
            Ne = void 0;
          }
        else
          Va
            ? bh(e, r) && (Ne = "onCompositionEnd")
            : e === "keydown" &&
              r.keyCode === 229 &&
              (Ne = "onCompositionStart");
        (Ne &&
          (vh &&
            r.locale !== "ko" &&
            (Va || Ne !== "onCompositionStart"
              ? Ne === "onCompositionEnd" && Va && (Ee = fh())
              : ((hr = X),
                (Su = "value" in hr ? hr.value : hr.textContent),
                (Va = !0))),
          (ye = Fo(H, Ne)),
          0 < ye.length &&
            ((Ne = new mh(Ne, e, null, r, X)),
            $.push({ event: Ne, listeners: ye }),
            Ee
              ? (Ne.data = Ee)
              : ((Ee = xh(r)), Ee !== null && (Ne.data = Ee)))),
          (Ee = Ix ? Zx(e, r) : Fx(e, r)) &&
            ((Ne = Fo(H, "onBeforeInput")),
            0 < Ne.length &&
              ((ye = new mh("onBeforeInput", "beforeinput", null, r, X)),
              $.push({ event: ye, listeners: Ne }),
              (ye.data = Ee))),
          kS($, e, H, r, X));
      }
      av($, t);
    });
  }
  function yl(e, t, r) {
    return { instance: e, listener: t, currentTarget: r };
  }
  function Fo(e, t) {
    for (var r = t + "Capture", l = []; e !== null; ) {
      var u = e,
        f = u.stateNode;
      if (
        ((u = u.tag),
        (u !== 5 && u !== 26 && u !== 27) ||
          f === null ||
          ((u = Bi(e, r)),
          u != null && l.unshift(yl(e, u, f)),
          (u = Bi(e, t)),
          u != null && l.push(yl(e, u, f))),
        e.tag === 3)
      )
        return l;
      e = e.return;
    }
    return [];
  }
  function GS(e) {
    if (e === null) return null;
    do e = e.return;
    while (e && e.tag !== 5 && e.tag !== 27);
    return e || null;
  }
  function lv(e, t, r, l, u) {
    for (var f = t._reactName, y = []; r !== null && r !== l; ) {
      var x = r,
        _ = x.alternate,
        H = x.stateNode;
      if (((x = x.tag), _ !== null && _ === l)) break;
      ((x !== 5 && x !== 26 && x !== 27) ||
        H === null ||
        ((_ = H),
        u
          ? ((H = Bi(r, f)), H != null && y.unshift(yl(r, H, _)))
          : u || ((H = Bi(r, f)), H != null && y.push(yl(r, H, _)))),
        (r = r.return));
    }
    y.length !== 0 && e.push({ event: t, listeners: y });
  }
  var KS = /\r\n?/g,
    XS = /\u0000|\uFFFD/g;
  function ov(e) {
    return (typeof e == "string" ? e : "" + e)
      .replace(
        KS,
        `
`,
      )
      .replace(XS, "");
  }
  function sv(e, t) {
    return ((t = ov(t)), ov(e) === t);
  }
  function Pe(e, t, r, l, u, f) {
    switch (r) {
      case "children":
        typeof l == "string"
          ? t === "body" || (t === "textarea" && l === "") || Pa(e, l)
          : (typeof l == "number" || typeof l == "bigint") &&
            t !== "body" &&
            Pa(e, "" + l);
        break;
      case "className":
        Wl(e, "class", l);
        break;
      case "tabIndex":
        Wl(e, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        Wl(e, r, l);
        break;
      case "style":
        sh(e, l, f);
        break;
      case "data":
        if (t !== "object") {
          Wl(e, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (t !== "a" || r !== "href")) {
          e.removeAttribute(r);
          break;
        }
        if (
          l == null ||
          typeof l == "function" ||
          typeof l == "symbol" ||
          typeof l == "boolean"
        ) {
          e.removeAttribute(r);
          break;
        }
        ((l = to("" + l)), e.setAttribute(r, l));
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          e.setAttribute(
            r,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')",
          );
          break;
        } else
          typeof f == "function" &&
            (r === "formAction"
              ? (t !== "input" && Pe(e, t, "name", u.name, u, null),
                Pe(e, t, "formEncType", u.formEncType, u, null),
                Pe(e, t, "formMethod", u.formMethod, u, null),
                Pe(e, t, "formTarget", u.formTarget, u, null))
              : (Pe(e, t, "encType", u.encType, u, null),
                Pe(e, t, "method", u.method, u, null),
                Pe(e, t, "target", u.target, u, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          e.removeAttribute(r);
          break;
        }
        ((l = to("" + l)), e.setAttribute(r, l));
        break;
      case "onClick":
        l != null && (e.onclick = qn);
        break;
      case "onScroll":
        l != null && Ae("scroll", e);
        break;
      case "onScrollEnd":
        l != null && Ae("scrollend", e);
        break;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(o(61));
          if (((r = l.__html), r != null)) {
            if (u.children != null) throw Error(o(60));
            e.innerHTML = r;
          }
        }
        break;
      case "multiple":
        e.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        e.muted = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (
          l == null ||
          typeof l == "function" ||
          typeof l == "boolean" ||
          typeof l == "symbol"
        ) {
          e.removeAttribute("xlink:href");
          break;
        }
        ((r = to("" + l)),
          e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", r));
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        l != null && typeof l != "function" && typeof l != "symbol"
          ? e.setAttribute(r, "" + l)
          : e.removeAttribute(r);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        l && typeof l != "function" && typeof l != "symbol"
          ? e.setAttribute(r, "")
          : e.removeAttribute(r);
        break;
      case "capture":
      case "download":
        l === !0
          ? e.setAttribute(r, "")
          : l !== !1 &&
              l != null &&
              typeof l != "function" &&
              typeof l != "symbol"
            ? e.setAttribute(r, l)
            : e.removeAttribute(r);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null &&
        typeof l != "function" &&
        typeof l != "symbol" &&
        !isNaN(l) &&
        1 <= l
          ? e.setAttribute(r, l)
          : e.removeAttribute(r);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l)
          ? e.removeAttribute(r)
          : e.setAttribute(r, l);
        break;
      case "popover":
        (Ae("beforetoggle", e), Ae("toggle", e), Jl(e, "popover", l));
        break;
      case "xlinkActuate":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:actuate", l);
        break;
      case "xlinkArcrole":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", l);
        break;
      case "xlinkRole":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:role", l);
        break;
      case "xlinkShow":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:show", l);
        break;
      case "xlinkTitle":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:title", l);
        break;
      case "xlinkType":
        Bn(e, "http://www.w3.org/1999/xlink", "xlink:type", l);
        break;
      case "xmlBase":
        Bn(e, "http://www.w3.org/XML/1998/namespace", "xml:base", l);
        break;
      case "xmlLang":
        Bn(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", l);
        break;
      case "xmlSpace":
        Bn(e, "http://www.w3.org/XML/1998/namespace", "xml:space", l);
        break;
      case "is":
        Jl(e, "is", l);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < r.length) ||
          (r[0] !== "o" && r[0] !== "O") ||
          (r[1] !== "n" && r[1] !== "N")) &&
          ((r = Sx.get(r) || r), Jl(e, r, l));
    }
  }
  function nf(e, t, r, l, u, f) {
    switch (r) {
      case "style":
        sh(e, l, f);
        break;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l)) throw Error(o(61));
          if (((r = l.__html), r != null)) {
            if (u.children != null) throw Error(o(60));
            e.innerHTML = r;
          }
        }
        break;
      case "children":
        typeof l == "string"
          ? Pa(e, l)
          : (typeof l == "number" || typeof l == "bigint") && Pa(e, "" + l);
        break;
      case "onScroll":
        l != null && Ae("scroll", e);
        break;
      case "onScrollEnd":
        l != null && Ae("scrollend", e);
        break;
      case "onClick":
        l != null && (e.onclick = qn);
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!Wd.hasOwnProperty(r))
          e: {
            if (
              r[0] === "o" &&
              r[1] === "n" &&
              ((u = r.endsWith("Capture")),
              (t = r.slice(2, u ? r.length - 7 : void 0)),
              (f = e[jt] || null),
              (f = f != null ? f[r] : null),
              typeof f == "function" && e.removeEventListener(t, f, u),
              typeof l == "function")
            ) {
              (typeof f != "function" &&
                f !== null &&
                (r in e
                  ? (e[r] = null)
                  : e.hasAttribute(r) && e.removeAttribute(r)),
                e.addEventListener(t, l, u));
              break e;
            }
            r in e
              ? (e[r] = l)
              : l === !0
                ? e.setAttribute(r, "")
                : Jl(e, r, l);
          }
    }
  }
  function gt(e, t, r) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        (Ae("error", e), Ae("load", e));
        var l = !1,
          u = !1,
          f;
        for (f in r)
          if (r.hasOwnProperty(f)) {
            var y = r[f];
            if (y != null)
              switch (f) {
                case "src":
                  l = !0;
                  break;
                case "srcSet":
                  u = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(o(137, t));
                default:
                  Pe(e, t, f, y, r, null);
              }
          }
        (u && Pe(e, t, "srcSet", r.srcSet, r, null),
          l && Pe(e, t, "src", r.src, r, null));
        return;
      case "input":
        Ae("invalid", e);
        var x = (f = y = u = null),
          _ = null,
          H = null;
        for (l in r)
          if (r.hasOwnProperty(l)) {
            var X = r[l];
            if (X != null)
              switch (l) {
                case "name":
                  u = X;
                  break;
                case "type":
                  y = X;
                  break;
                case "checked":
                  _ = X;
                  break;
                case "defaultChecked":
                  H = X;
                  break;
                case "value":
                  f = X;
                  break;
                case "defaultValue":
                  x = X;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (X != null) throw Error(o(137, t));
                  break;
                default:
                  Pe(e, t, l, X, r, null);
              }
          }
        ah(e, f, x, _, H, y, u, !1);
        return;
      case "select":
        (Ae("invalid", e), (l = y = f = null));
        for (u in r)
          if (r.hasOwnProperty(u) && ((x = r[u]), x != null))
            switch (u) {
              case "value":
                f = x;
                break;
              case "defaultValue":
                y = x;
                break;
              case "multiple":
                l = x;
              default:
                Pe(e, t, u, x, r, null);
            }
        ((t = f),
          (r = y),
          (e.multiple = !!l),
          t != null ? qa(e, !!l, t, !1) : r != null && qa(e, !!l, r, !0));
        return;
      case "textarea":
        (Ae("invalid", e), (f = u = l = null));
        for (y in r)
          if (r.hasOwnProperty(y) && ((x = r[y]), x != null))
            switch (y) {
              case "value":
                l = x;
                break;
              case "defaultValue":
                u = x;
                break;
              case "children":
                f = x;
                break;
              case "dangerouslySetInnerHTML":
                if (x != null) throw Error(o(91));
                break;
              default:
                Pe(e, t, y, x, r, null);
            }
        lh(e, l, u, f);
        return;
      case "option":
        for (_ in r)
          r.hasOwnProperty(_) &&
            ((l = r[_]), l != null) &&
            (_ === "selected"
              ? (e.selected =
                  l && typeof l != "function" && typeof l != "symbol")
              : Pe(e, t, _, l, r, null));
        return;
      case "dialog":
        (Ae("beforetoggle", e),
          Ae("toggle", e),
          Ae("cancel", e),
          Ae("close", e));
        break;
      case "iframe":
      case "object":
        Ae("load", e);
        break;
      case "video":
      case "audio":
        for (l = 0; l < vl.length; l++) Ae(vl[l], e);
        break;
      case "image":
        (Ae("error", e), Ae("load", e));
        break;
      case "details":
        Ae("toggle", e);
        break;
      case "embed":
      case "source":
      case "link":
        (Ae("error", e), Ae("load", e));
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (H in r)
          if (r.hasOwnProperty(H) && ((l = r[H]), l != null))
            switch (H) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(o(137, t));
              default:
                Pe(e, t, H, l, r, null);
            }
        return;
      default:
        if (vu(t)) {
          for (X in r)
            r.hasOwnProperty(X) &&
              ((l = r[X]), l !== void 0 && nf(e, t, X, l, r, void 0));
          return;
        }
    }
    for (x in r)
      r.hasOwnProperty(x) && ((l = r[x]), l != null && Pe(e, t, x, l, r, null));
  }
  function IS(e, t, r, l) {
    switch (t) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var u = null,
          f = null,
          y = null,
          x = null,
          _ = null,
          H = null,
          X = null;
        for (Y in r) {
          var $ = r[Y];
          if (r.hasOwnProperty(Y) && $ != null)
            switch (Y) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                _ = $;
              default:
                l.hasOwnProperty(Y) || Pe(e, t, Y, null, l, $);
            }
        }
        for (var P in l) {
          var Y = l[P];
          if ((($ = r[P]), l.hasOwnProperty(P) && (Y != null || $ != null)))
            switch (P) {
              case "type":
                f = Y;
                break;
              case "name":
                u = Y;
                break;
              case "checked":
                H = Y;
                break;
              case "defaultChecked":
                X = Y;
                break;
              case "value":
                y = Y;
                break;
              case "defaultValue":
                x = Y;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (Y != null) throw Error(o(137, t));
                break;
              default:
                Y !== $ && Pe(e, t, P, Y, l, $);
            }
        }
        mu(e, y, x, _, H, X, f, u);
        return;
      case "select":
        Y = y = x = P = null;
        for (f in r)
          if (((_ = r[f]), r.hasOwnProperty(f) && _ != null))
            switch (f) {
              case "value":
                break;
              case "multiple":
                Y = _;
              default:
                l.hasOwnProperty(f) || Pe(e, t, f, null, l, _);
            }
        for (u in l)
          if (
            ((f = l[u]),
            (_ = r[u]),
            l.hasOwnProperty(u) && (f != null || _ != null))
          )
            switch (u) {
              case "value":
                P = f;
                break;
              case "defaultValue":
                x = f;
                break;
              case "multiple":
                y = f;
              default:
                f !== _ && Pe(e, t, u, f, l, _);
            }
        ((t = x),
          (r = y),
          (l = Y),
          P != null
            ? qa(e, !!r, P, !1)
            : !!l != !!r &&
              (t != null ? qa(e, !!r, t, !0) : qa(e, !!r, r ? [] : "", !1)));
        return;
      case "textarea":
        Y = P = null;
        for (x in r)
          if (
            ((u = r[x]),
            r.hasOwnProperty(x) && u != null && !l.hasOwnProperty(x))
          )
            switch (x) {
              case "value":
                break;
              case "children":
                break;
              default:
                Pe(e, t, x, null, l, u);
            }
        for (y in l)
          if (
            ((u = l[y]),
            (f = r[y]),
            l.hasOwnProperty(y) && (u != null || f != null))
          )
            switch (y) {
              case "value":
                P = u;
                break;
              case "defaultValue":
                Y = u;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (u != null) throw Error(o(91));
                break;
              default:
                u !== f && Pe(e, t, y, u, l, f);
            }
        ih(e, P, Y);
        return;
      case "option":
        for (var he in r)
          ((P = r[he]),
            r.hasOwnProperty(he) &&
              P != null &&
              !l.hasOwnProperty(he) &&
              (he === "selected"
                ? (e.selected = !1)
                : Pe(e, t, he, null, l, P)));
        for (_ in l)
          ((P = l[_]),
            (Y = r[_]),
            l.hasOwnProperty(_) &&
              P !== Y &&
              (P != null || Y != null) &&
              (_ === "selected"
                ? (e.selected =
                    P && typeof P != "function" && typeof P != "symbol")
                : Pe(e, t, _, P, l, Y)));
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var be in r)
          ((P = r[be]),
            r.hasOwnProperty(be) &&
              P != null &&
              !l.hasOwnProperty(be) &&
              Pe(e, t, be, null, l, P));
        for (H in l)
          if (
            ((P = l[H]),
            (Y = r[H]),
            l.hasOwnProperty(H) && P !== Y && (P != null || Y != null))
          )
            switch (H) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (P != null) throw Error(o(137, t));
                break;
              default:
                Pe(e, t, H, P, l, Y);
            }
        return;
      default:
        if (vu(t)) {
          for (var ke in r)
            ((P = r[ke]),
              r.hasOwnProperty(ke) &&
                P !== void 0 &&
                !l.hasOwnProperty(ke) &&
                nf(e, t, ke, void 0, l, P));
          for (X in l)
            ((P = l[X]),
              (Y = r[X]),
              !l.hasOwnProperty(X) ||
                P === Y ||
                (P === void 0 && Y === void 0) ||
                nf(e, t, X, P, l, Y));
          return;
        }
    }
    for (var z in r)
      ((P = r[z]),
        r.hasOwnProperty(z) &&
          P != null &&
          !l.hasOwnProperty(z) &&
          Pe(e, t, z, null, l, P));
    for ($ in l)
      ((P = l[$]),
        (Y = r[$]),
        !l.hasOwnProperty($) ||
          P === Y ||
          (P == null && Y == null) ||
          Pe(e, t, $, P, l, Y));
  }
  function uv(e) {
    switch (e) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function ZS() {
    if (typeof performance.getEntriesByType == "function") {
      for (
        var e = 0, t = 0, r = performance.getEntriesByType("resource"), l = 0;
        l < r.length;
        l++
      ) {
        var u = r[l],
          f = u.transferSize,
          y = u.initiatorType,
          x = u.duration;
        if (f && x && uv(y)) {
          for (y = 0, x = u.responseEnd, l += 1; l < r.length; l++) {
            var _ = r[l],
              H = _.startTime;
            if (H > x) break;
            var X = _.transferSize,
              $ = _.initiatorType;
            X &&
              uv($) &&
              ((_ = _.responseEnd), (y += X * (_ < x ? 1 : (x - H) / (_ - H))));
          }
          if ((--l, (t += (8 * (f + y)) / (u.duration / 1e3)), e++, 10 < e))
            break;
        }
      }
      if (0 < e) return t / e / 1e6;
    }
    return navigator.connection &&
      ((e = navigator.connection.downlink), typeof e == "number")
      ? e
      : 5;
  }
  var rf = null,
    af = null;
  function $o(e) {
    return e.nodeType === 9 ? e : e.ownerDocument;
  }
  function cv(e) {
    switch (e) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function fv(e, t) {
    if (e === 0)
      switch (t) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return e === 1 && t === "foreignObject" ? 0 : e;
  }
  function lf(e, t) {
    return (
      e === "textarea" ||
      e === "noscript" ||
      typeof t.children == "string" ||
      typeof t.children == "number" ||
      typeof t.children == "bigint" ||
      (typeof t.dangerouslySetInnerHTML == "object" &&
        t.dangerouslySetInnerHTML !== null &&
        t.dangerouslySetInnerHTML.__html != null)
    );
  }
  var of = null;
  function FS() {
    var e = window.event;
    return e && e.type === "popstate"
      ? e === of
        ? !1
        : ((of = e), !0)
      : ((of = null), !1);
  }
  var dv = typeof setTimeout == "function" ? setTimeout : void 0,
    $S = typeof clearTimeout == "function" ? clearTimeout : void 0,
    hv = typeof Promise == "function" ? Promise : void 0,
    JS =
      typeof queueMicrotask == "function"
        ? queueMicrotask
        : typeof hv < "u"
          ? function (e) {
              return hv.resolve(null).then(e).catch(WS);
            }
          : dv;
  function WS(e) {
    setTimeout(function () {
      throw e;
    });
  }
  function Mr(e) {
    return e === "head";
  }
  function mv(e, t) {
    var r = t,
      l = 0;
    do {
      var u = r.nextSibling;
      if ((e.removeChild(r), u && u.nodeType === 8))
        if (((r = u.data), r === "/$" || r === "/&")) {
          if (l === 0) {
            (e.removeChild(u), yi(t));
            return;
          }
          l--;
        } else if (
          r === "$" ||
          r === "$?" ||
          r === "$~" ||
          r === "$!" ||
          r === "&"
        )
          l++;
        else if (r === "html") gl(e.ownerDocument.documentElement);
        else if (r === "head") {
          ((r = e.ownerDocument.head), gl(r));
          for (var f = r.firstChild; f; ) {
            var y = f.nextSibling,
              x = f.nodeName;
            (f[Li] ||
              x === "SCRIPT" ||
              x === "STYLE" ||
              (x === "LINK" && f.rel.toLowerCase() === "stylesheet") ||
              r.removeChild(f),
              (f = y));
          }
        } else r === "body" && gl(e.ownerDocument.body);
      r = u;
    } while (r);
    yi(t);
  }
  function pv(e, t) {
    var r = e;
    e = 0;
    do {
      var l = r.nextSibling;
      if (
        (r.nodeType === 1
          ? t
            ? ((r._stashedDisplay = r.style.display),
              (r.style.display = "none"))
            : ((r.style.display = r._stashedDisplay || ""),
              r.getAttribute("style") === "" && r.removeAttribute("style"))
          : r.nodeType === 3 &&
            (t
              ? ((r._stashedText = r.nodeValue), (r.nodeValue = ""))
              : (r.nodeValue = r._stashedText || "")),
        l && l.nodeType === 8)
      )
        if (((r = l.data), r === "/$")) {
          if (e === 0) break;
          e--;
        } else (r !== "$" && r !== "$?" && r !== "$~" && r !== "$!") || e++;
      r = l;
    } while (r);
  }
  function sf(e) {
    var t = e.firstChild;
    for (t && t.nodeType === 10 && (t = t.nextSibling); t; ) {
      var r = t;
      switch (((t = t.nextSibling), r.nodeName)) {
        case "HTML":
        case "HEAD":
        case "BODY":
          (sf(r), du(r));
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (r.rel.toLowerCase() === "stylesheet") continue;
      }
      e.removeChild(r);
    }
  }
  function e1(e, t, r, l) {
    for (; e.nodeType === 1; ) {
      var u = r;
      if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
        if (!l && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
      } else if (l) {
        if (!e[Li])
          switch (t) {
            case "meta":
              if (!e.hasAttribute("itemprop")) break;
              return e;
            case "link":
              if (
                ((f = e.getAttribute("rel")),
                f === "stylesheet" && e.hasAttribute("data-precedence"))
              )
                break;
              if (
                f !== u.rel ||
                e.getAttribute("href") !==
                  (u.href == null || u.href === "" ? null : u.href) ||
                e.getAttribute("crossorigin") !==
                  (u.crossOrigin == null ? null : u.crossOrigin) ||
                e.getAttribute("title") !== (u.title == null ? null : u.title)
              )
                break;
              return e;
            case "style":
              if (e.hasAttribute("data-precedence")) break;
              return e;
            case "script":
              if (
                ((f = e.getAttribute("src")),
                (f !== (u.src == null ? null : u.src) ||
                  e.getAttribute("type") !== (u.type == null ? null : u.type) ||
                  e.getAttribute("crossorigin") !==
                    (u.crossOrigin == null ? null : u.crossOrigin)) &&
                  f &&
                  e.hasAttribute("async") &&
                  !e.hasAttribute("itemprop"))
              )
                break;
              return e;
            default:
              return e;
          }
      } else if (t === "input" && e.type === "hidden") {
        var f = u.name == null ? null : "" + u.name;
        if (u.type === "hidden" && e.getAttribute("name") === f) return e;
      } else return e;
      if (((e = on(e.nextSibling)), e === null)) break;
    }
    return null;
  }
  function t1(e, t, r) {
    if (t === "") return null;
    for (; e.nodeType !== 3; )
      if (
        ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") &&
          !r) ||
        ((e = on(e.nextSibling)), e === null)
      )
        return null;
    return e;
  }
  function vv(e, t) {
    for (; e.nodeType !== 8; )
      if (
        ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") &&
          !t) ||
        ((e = on(e.nextSibling)), e === null)
      )
        return null;
    return e;
  }
  function uf(e) {
    return e.data === "$?" || e.data === "$~";
  }
  function cf(e) {
    return (
      e.data === "$!" ||
      (e.data === "$?" && e.ownerDocument.readyState !== "loading")
    );
  }
  function n1(e, t) {
    var r = e.ownerDocument;
    if (e.data === "$~") e._reactRetry = t;
    else if (e.data !== "$?" || r.readyState !== "loading") t();
    else {
      var l = function () {
        (t(), r.removeEventListener("DOMContentLoaded", l));
      };
      (r.addEventListener("DOMContentLoaded", l), (e._reactRetry = l));
    }
  }
  function on(e) {
    for (; e != null; e = e.nextSibling) {
      var t = e.nodeType;
      if (t === 1 || t === 3) break;
      if (t === 8) {
        if (
          ((t = e.data),
          t === "$" ||
            t === "$!" ||
            t === "$?" ||
            t === "$~" ||
            t === "&" ||
            t === "F!" ||
            t === "F")
        )
          break;
        if (t === "/$" || t === "/&") return null;
      }
    }
    return e;
  }
  var ff = null;
  function yv(e) {
    e = e.nextSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var r = e.data;
        if (r === "/$" || r === "/&") {
          if (t === 0) return on(e.nextSibling);
          t--;
        } else
          (r !== "$" && r !== "$!" && r !== "$?" && r !== "$~" && r !== "&") ||
            t++;
      }
      e = e.nextSibling;
    }
    return null;
  }
  function gv(e) {
    e = e.previousSibling;
    for (var t = 0; e; ) {
      if (e.nodeType === 8) {
        var r = e.data;
        if (r === "$" || r === "$!" || r === "$?" || r === "$~" || r === "&") {
          if (t === 0) return e;
          t--;
        } else (r !== "/$" && r !== "/&") || t++;
      }
      e = e.previousSibling;
    }
    return null;
  }
  function bv(e, t, r) {
    switch (((t = $o(r)), e)) {
      case "html":
        if (((e = t.documentElement), !e)) throw Error(o(452));
        return e;
      case "head":
        if (((e = t.head), !e)) throw Error(o(453));
        return e;
      case "body":
        if (((e = t.body), !e)) throw Error(o(454));
        return e;
      default:
        throw Error(o(451));
    }
  }
  function gl(e) {
    for (var t = e.attributes; t.length; ) e.removeAttributeNode(t[0]);
    du(e);
  }
  var sn = new Map(),
    xv = new Set();
  function Jo(e) {
    return typeof e.getRootNode == "function"
      ? e.getRootNode()
      : e.nodeType === 9
        ? e
        : e.ownerDocument;
  }
  var tr = B.d;
  B.d = { f: r1, r: a1, D: i1, C: l1, L: o1, m: s1, X: c1, S: u1, M: f1 };
  function r1() {
    var e = tr.f(),
      t = Vo();
    return e || t;
  }
  function a1(e) {
    var t = La(e);
    t !== null && t.tag === 5 && t.type === "form" ? Hm(t) : tr.r(e);
  }
  var mi = typeof document > "u" ? null : document;
  function Sv(e, t, r) {
    var l = mi;
    if (l && typeof t == "string" && t) {
      var u = Wt(t);
      ((u = 'link[rel="' + e + '"][href="' + u + '"]'),
        typeof r == "string" && (u += '[crossorigin="' + r + '"]'),
        xv.has(u) ||
          (xv.add(u),
          (e = { rel: e, crossOrigin: r, href: t }),
          l.querySelector(u) === null &&
            ((t = l.createElement("link")),
            gt(t, "link", e),
            dt(t),
            l.head.appendChild(t))));
    }
  }
  function i1(e) {
    (tr.D(e), Sv("dns-prefetch", e, null));
  }
  function l1(e, t) {
    (tr.C(e, t), Sv("preconnect", e, t));
  }
  function o1(e, t, r) {
    tr.L(e, t, r);
    var l = mi;
    if (l && e && t) {
      var u = 'link[rel="preload"][as="' + Wt(t) + '"]';
      t === "image" && r && r.imageSrcSet
        ? ((u += '[imagesrcset="' + Wt(r.imageSrcSet) + '"]'),
          typeof r.imageSizes == "string" &&
            (u += '[imagesizes="' + Wt(r.imageSizes) + '"]'))
        : (u += '[href="' + Wt(e) + '"]');
      var f = u;
      switch (t) {
        case "style":
          f = pi(e);
          break;
        case "script":
          f = vi(e);
      }
      sn.has(f) ||
        ((e = v(
          {
            rel: "preload",
            href: t === "image" && r && r.imageSrcSet ? void 0 : e,
            as: t,
          },
          r,
        )),
        sn.set(f, e),
        l.querySelector(u) !== null ||
          (t === "style" && l.querySelector(bl(f))) ||
          (t === "script" && l.querySelector(xl(f))) ||
          ((t = l.createElement("link")),
          gt(t, "link", e),
          dt(t),
          l.head.appendChild(t)));
    }
  }
  function s1(e, t) {
    tr.m(e, t);
    var r = mi;
    if (r && e) {
      var l = t && typeof t.as == "string" ? t.as : "script",
        u =
          'link[rel="modulepreload"][as="' + Wt(l) + '"][href="' + Wt(e) + '"]',
        f = u;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          f = vi(e);
      }
      if (
        !sn.has(f) &&
        ((e = v({ rel: "modulepreload", href: e }, t)),
        sn.set(f, e),
        r.querySelector(u) === null)
      ) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (r.querySelector(xl(f))) return;
        }
        ((l = r.createElement("link")),
          gt(l, "link", e),
          dt(l),
          r.head.appendChild(l));
      }
    }
  }
  function u1(e, t, r) {
    tr.S(e, t, r);
    var l = mi;
    if (l && e) {
      var u = Ha(l).hoistableStyles,
        f = pi(e);
      t = t || "default";
      var y = u.get(f);
      if (!y) {
        var x = { loading: 0, preload: null };
        if ((y = l.querySelector(bl(f)))) x.loading = 5;
        else {
          ((e = v({ rel: "stylesheet", href: e, "data-precedence": t }, r)),
            (r = sn.get(f)) && df(e, r));
          var _ = (y = l.createElement("link"));
          (dt(_),
            gt(_, "link", e),
            (_._p = new Promise(function (H, X) {
              ((_.onload = H), (_.onerror = X));
            })),
            _.addEventListener("load", function () {
              x.loading |= 1;
            }),
            _.addEventListener("error", function () {
              x.loading |= 2;
            }),
            (x.loading |= 4),
            Wo(y, t, l));
        }
        ((y = { type: "stylesheet", instance: y, count: 1, state: x }),
          u.set(f, y));
      }
    }
  }
  function c1(e, t) {
    tr.X(e, t);
    var r = mi;
    if (r && e) {
      var l = Ha(r).hoistableScripts,
        u = vi(e),
        f = l.get(u);
      f ||
        ((f = r.querySelector(xl(u))),
        f ||
          ((e = v({ src: e, async: !0 }, t)),
          (t = sn.get(u)) && hf(e, t),
          (f = r.createElement("script")),
          dt(f),
          gt(f, "link", e),
          r.head.appendChild(f)),
        (f = { type: "script", instance: f, count: 1, state: null }),
        l.set(u, f));
    }
  }
  function f1(e, t) {
    tr.M(e, t);
    var r = mi;
    if (r && e) {
      var l = Ha(r).hoistableScripts,
        u = vi(e),
        f = l.get(u);
      f ||
        ((f = r.querySelector(xl(u))),
        f ||
          ((e = v({ src: e, async: !0, type: "module" }, t)),
          (t = sn.get(u)) && hf(e, t),
          (f = r.createElement("script")),
          dt(f),
          gt(f, "link", e),
          r.head.appendChild(f)),
        (f = { type: "script", instance: f, count: 1, state: null }),
        l.set(u, f));
    }
  }
  function wv(e, t, r, l) {
    var u = (u = ue.current) ? Jo(u) : null;
    if (!u) throw Error(o(446));
    switch (e) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof r.precedence == "string" && typeof r.href == "string"
          ? ((t = pi(r.href)),
            (r = Ha(u).hoistableStyles),
            (l = r.get(t)),
            l ||
              ((l = { type: "style", instance: null, count: 0, state: null }),
              r.set(t, l)),
            l)
          : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (
          r.rel === "stylesheet" &&
          typeof r.href == "string" &&
          typeof r.precedence == "string"
        ) {
          e = pi(r.href);
          var f = Ha(u).hoistableStyles,
            y = f.get(e);
          if (
            (y ||
              ((u = u.ownerDocument || u),
              (y = {
                type: "stylesheet",
                instance: null,
                count: 0,
                state: { loading: 0, preload: null },
              }),
              f.set(e, y),
              (f = u.querySelector(bl(e))) &&
                !f._p &&
                ((y.instance = f), (y.state.loading = 5)),
              sn.has(e) ||
                ((r = {
                  rel: "preload",
                  as: "style",
                  href: r.href,
                  crossOrigin: r.crossOrigin,
                  integrity: r.integrity,
                  media: r.media,
                  hrefLang: r.hrefLang,
                  referrerPolicy: r.referrerPolicy,
                }),
                sn.set(e, r),
                f || d1(u, e, r, y.state))),
            t && l === null)
          )
            throw Error(o(528, ""));
          return y;
        }
        if (t && l !== null) throw Error(o(529, ""));
        return null;
      case "script":
        return (
          (t = r.async),
          (r = r.src),
          typeof r == "string" &&
          t &&
          typeof t != "function" &&
          typeof t != "symbol"
            ? ((t = vi(r)),
              (r = Ha(u).hoistableScripts),
              (l = r.get(t)),
              l ||
                ((l = {
                  type: "script",
                  instance: null,
                  count: 0,
                  state: null,
                }),
                r.set(t, l)),
              l)
            : { type: "void", instance: null, count: 0, state: null }
        );
      default:
        throw Error(o(444, e));
    }
  }
  function pi(e) {
    return 'href="' + Wt(e) + '"';
  }
  function bl(e) {
    return 'link[rel="stylesheet"][' + e + "]";
  }
  function Ev(e) {
    return v({}, e, { "data-precedence": e.precedence, precedence: null });
  }
  function d1(e, t, r, l) {
    e.querySelector('link[rel="preload"][as="style"][' + t + "]")
      ? (l.loading = 1)
      : ((t = e.createElement("link")),
        (l.preload = t),
        t.addEventListener("load", function () {
          return (l.loading |= 1);
        }),
        t.addEventListener("error", function () {
          return (l.loading |= 2);
        }),
        gt(t, "link", r),
        dt(t),
        e.head.appendChild(t));
  }
  function vi(e) {
    return '[src="' + Wt(e) + '"]';
  }
  function xl(e) {
    return "script[async]" + e;
  }
  function Ov(e, t, r) {
    if ((t.count++, t.instance === null))
      switch (t.type) {
        case "style":
          var l = e.querySelector('style[data-href~="' + Wt(r.href) + '"]');
          if (l) return ((t.instance = l), dt(l), l);
          var u = v({}, r, {
            "data-href": r.href,
            "data-precedence": r.precedence,
            href: null,
            precedence: null,
          });
          return (
            (l = (e.ownerDocument || e).createElement("style")),
            dt(l),
            gt(l, "style", u),
            Wo(l, r.precedence, e),
            (t.instance = l)
          );
        case "stylesheet":
          u = pi(r.href);
          var f = e.querySelector(bl(u));
          if (f) return ((t.state.loading |= 4), (t.instance = f), dt(f), f);
          ((l = Ev(r)),
            (u = sn.get(u)) && df(l, u),
            (f = (e.ownerDocument || e).createElement("link")),
            dt(f));
          var y = f;
          return (
            (y._p = new Promise(function (x, _) {
              ((y.onload = x), (y.onerror = _));
            })),
            gt(f, "link", l),
            (t.state.loading |= 4),
            Wo(f, r.precedence, e),
            (t.instance = f)
          );
        case "script":
          return (
            (f = vi(r.src)),
            (u = e.querySelector(xl(f)))
              ? ((t.instance = u), dt(u), u)
              : ((l = r),
                (u = sn.get(f)) && ((l = v({}, r)), hf(l, u)),
                (e = e.ownerDocument || e),
                (u = e.createElement("script")),
                dt(u),
                gt(u, "link", l),
                e.head.appendChild(u),
                (t.instance = u))
          );
        case "void":
          return null;
        default:
          throw Error(o(443, t.type));
      }
    else
      t.type === "stylesheet" &&
        (t.state.loading & 4) === 0 &&
        ((l = t.instance), (t.state.loading |= 4), Wo(l, r.precedence, e));
    return t.instance;
  }
  function Wo(e, t, r) {
    for (
      var l = r.querySelectorAll(
          'link[rel="stylesheet"][data-precedence],style[data-precedence]',
        ),
        u = l.length ? l[l.length - 1] : null,
        f = u,
        y = 0;
      y < l.length;
      y++
    ) {
      var x = l[y];
      if (x.dataset.precedence === t) f = x;
      else if (f !== u) break;
    }
    f
      ? f.parentNode.insertBefore(e, f.nextSibling)
      : ((t = r.nodeType === 9 ? r.head : r), t.insertBefore(e, t.firstChild));
  }
  function df(e, t) {
    (e.crossOrigin == null && (e.crossOrigin = t.crossOrigin),
      e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy),
      e.title == null && (e.title = t.title));
  }
  function hf(e, t) {
    (e.crossOrigin == null && (e.crossOrigin = t.crossOrigin),
      e.referrerPolicy == null && (e.referrerPolicy = t.referrerPolicy),
      e.integrity == null && (e.integrity = t.integrity));
  }
  var es = null;
  function Cv(e, t, r) {
    if (es === null) {
      var l = new Map(),
        u = (es = new Map());
      u.set(r, l);
    } else ((u = es), (l = u.get(r)), l || ((l = new Map()), u.set(r, l)));
    if (l.has(e)) return l;
    for (
      l.set(e, null), r = r.getElementsByTagName(e), u = 0;
      u < r.length;
      u++
    ) {
      var f = r[u];
      if (
        !(
          f[Li] ||
          f[mt] ||
          (e === "link" && f.getAttribute("rel") === "stylesheet")
        ) &&
        f.namespaceURI !== "http://www.w3.org/2000/svg"
      ) {
        var y = f.getAttribute(t) || "";
        y = e + y;
        var x = l.get(y);
        x ? x.push(f) : l.set(y, [f]);
      }
    }
    return l;
  }
  function Tv(e, t, r) {
    ((e = e.ownerDocument || e),
      e.head.insertBefore(
        r,
        t === "title" ? e.querySelector("head > title") : null,
      ));
  }
  function h1(e, t, r) {
    if (r === 1 || t.itemProp != null) return !1;
    switch (e) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (
          typeof t.precedence != "string" ||
          typeof t.href != "string" ||
          t.href === ""
        )
          break;
        return !0;
      case "link":
        if (
          typeof t.rel != "string" ||
          typeof t.href != "string" ||
          t.href === "" ||
          t.onLoad ||
          t.onError
        )
          break;
        return t.rel === "stylesheet"
          ? ((e = t.disabled), typeof t.precedence == "string" && e == null)
          : !0;
      case "script":
        if (
          t.async &&
          typeof t.async != "function" &&
          typeof t.async != "symbol" &&
          !t.onLoad &&
          !t.onError &&
          t.src &&
          typeof t.src == "string"
        )
          return !0;
    }
    return !1;
  }
  function _v(e) {
    return !(e.type === "stylesheet" && (e.state.loading & 3) === 0);
  }
  function m1(e, t, r, l) {
    if (
      r.type === "stylesheet" &&
      (typeof l.media != "string" || matchMedia(l.media).matches !== !1) &&
      (r.state.loading & 4) === 0
    ) {
      if (r.instance === null) {
        var u = pi(l.href),
          f = t.querySelector(bl(u));
        if (f) {
          ((t = f._p),
            t !== null &&
              typeof t == "object" &&
              typeof t.then == "function" &&
              (e.count++, (e = ts.bind(e)), t.then(e, e)),
            (r.state.loading |= 4),
            (r.instance = f),
            dt(f));
          return;
        }
        ((f = t.ownerDocument || t),
          (l = Ev(l)),
          (u = sn.get(u)) && df(l, u),
          (f = f.createElement("link")),
          dt(f));
        var y = f;
        ((y._p = new Promise(function (x, _) {
          ((y.onload = x), (y.onerror = _));
        })),
          gt(f, "link", l),
          (r.instance = f));
      }
      (e.stylesheets === null && (e.stylesheets = new Map()),
        e.stylesheets.set(r, t),
        (t = r.state.preload) &&
          (r.state.loading & 3) === 0 &&
          (e.count++,
          (r = ts.bind(e)),
          t.addEventListener("load", r),
          t.addEventListener("error", r)));
    }
  }
  var mf = 0;
  function p1(e, t) {
    return (
      e.stylesheets && e.count === 0 && rs(e, e.stylesheets),
      0 < e.count || 0 < e.imgCount
        ? function (r) {
            var l = setTimeout(function () {
              if ((e.stylesheets && rs(e, e.stylesheets), e.unsuspend)) {
                var f = e.unsuspend;
                ((e.unsuspend = null), f());
              }
            }, 6e4 + t);
            0 < e.imgBytes && mf === 0 && (mf = 62500 * ZS());
            var u = setTimeout(
              function () {
                if (
                  ((e.waitingForImages = !1),
                  e.count === 0 &&
                    (e.stylesheets && rs(e, e.stylesheets), e.unsuspend))
                ) {
                  var f = e.unsuspend;
                  ((e.unsuspend = null), f());
                }
              },
              (e.imgBytes > mf ? 50 : 800) + t,
            );
            return (
              (e.unsuspend = r),
              function () {
                ((e.unsuspend = null), clearTimeout(l), clearTimeout(u));
              }
            );
          }
        : null
    );
  }
  function ts() {
    if (
      (this.count--,
      this.count === 0 && (this.imgCount === 0 || !this.waitingForImages))
    ) {
      if (this.stylesheets) rs(this, this.stylesheets);
      else if (this.unsuspend) {
        var e = this.unsuspend;
        ((this.unsuspend = null), e());
      }
    }
  }
  var ns = null;
  function rs(e, t) {
    ((e.stylesheets = null),
      e.unsuspend !== null &&
        (e.count++,
        (ns = new Map()),
        t.forEach(v1, e),
        (ns = null),
        ts.call(e)));
  }
  function v1(e, t) {
    if (!(t.state.loading & 4)) {
      var r = ns.get(e);
      if (r) var l = r.get(null);
      else {
        ((r = new Map()), ns.set(e, r));
        for (
          var u = e.querySelectorAll(
              "link[data-precedence],style[data-precedence]",
            ),
            f = 0;
          f < u.length;
          f++
        ) {
          var y = u[f];
          (y.nodeName === "LINK" || y.getAttribute("media") !== "not all") &&
            (r.set(y.dataset.precedence, y), (l = y));
        }
        l && r.set(null, l);
      }
      ((u = t.instance),
        (y = u.getAttribute("data-precedence")),
        (f = r.get(y) || l),
        f === l && r.set(null, u),
        r.set(y, u),
        this.count++,
        (l = ts.bind(this)),
        u.addEventListener("load", l),
        u.addEventListener("error", l),
        f
          ? f.parentNode.insertBefore(u, f.nextSibling)
          : ((e = e.nodeType === 9 ? e.head : e),
            e.insertBefore(u, e.firstChild)),
        (t.state.loading |= 4));
    }
  }
  var Sl = {
    $$typeof: q,
    Provider: null,
    Consumer: null,
    _currentValue: K,
    _currentValue2: K,
    _threadCount: 0,
  };
  function y1(e, t, r, l, u, f, y, x, _) {
    ((this.tag = 1),
      (this.containerInfo = e),
      (this.pingCache = this.current = this.pendingChildren = null),
      (this.timeoutHandle = -1),
      (this.callbackNode =
        this.next =
        this.pendingContext =
        this.context =
        this.cancelPendingCommit =
          null),
      (this.callbackPriority = 0),
      (this.expirationTimes = fr(-1)),
      (this.entangledLanes =
        this.shellSuspendCounter =
        this.errorRecoveryDisabledLanes =
        this.expiredLanes =
        this.warmLanes =
        this.pingedLanes =
        this.suspendedLanes =
        this.pendingLanes =
          0),
      (this.entanglements = fr(0)),
      (this.hiddenUpdates = fr(null)),
      (this.identifierPrefix = l),
      (this.onUncaughtError = u),
      (this.onCaughtError = f),
      (this.onRecoverableError = y),
      (this.pooledCache = null),
      (this.pooledCacheLanes = 0),
      (this.formState = _),
      (this.incompleteTransitions = new Map()));
  }
  function Av(e, t, r, l, u, f, y, x, _, H, X, $) {
    return (
      (e = new y1(e, t, r, y, _, H, X, $, x)),
      (t = 1),
      f === !0 && (t |= 24),
      (f = Vt(3, null, null, t)),
      (e.current = f),
      (f.stateNode = e),
      (t = Ku()),
      t.refCount++,
      (e.pooledCache = t),
      t.refCount++,
      (f.memoizedState = { element: l, isDehydrated: r, cache: t }),
      Fu(f),
      e
    );
  }
  function Rv(e) {
    return e ? ((e = Xa), e) : Xa;
  }
  function Mv(e, t, r, l, u, f) {
    ((u = Rv(u)),
      l.context === null ? (l.context = u) : (l.pendingContext = u),
      (l = br(t)),
      (l.payload = { element: r }),
      (f = f === void 0 ? null : f),
      f !== null && (l.callback = f),
      (r = xr(e, l, t)),
      r !== null && (qt(r, e, t), Wi(r, e, t)));
  }
  function Nv(e, t) {
    if (((e = e.memoizedState), e !== null && e.dehydrated !== null)) {
      var r = e.retryLane;
      e.retryLane = r !== 0 && r < t ? r : t;
    }
  }
  function pf(e, t) {
    (Nv(e, t), (e = e.alternate) && Nv(e, t));
  }
  function Dv(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = ia(e, 67108864);
      (t !== null && qt(t, e, 67108864), pf(e, 67108864));
    }
  }
  function jv(e) {
    if (e.tag === 13 || e.tag === 31) {
      var t = It();
      t = ja(t);
      var r = ia(e, t);
      (r !== null && qt(r, e, t), pf(e, t));
    }
  }
  var as = !0;
  function g1(e, t, r, l) {
    var u = A.T;
    A.T = null;
    var f = B.p;
    try {
      ((B.p = 2), vf(e, t, r, l));
    } finally {
      ((B.p = f), (A.T = u));
    }
  }
  function b1(e, t, r, l) {
    var u = A.T;
    A.T = null;
    var f = B.p;
    try {
      ((B.p = 8), vf(e, t, r, l));
    } finally {
      ((B.p = f), (A.T = u));
    }
  }
  function vf(e, t, r, l) {
    if (as) {
      var u = yf(l);
      if (u === null) (tf(e, t, l, is, r), Uv(e, l));
      else if (S1(u, e, t, r, l)) l.stopPropagation();
      else if ((Uv(e, l), t & 4 && -1 < x1.indexOf(e))) {
        for (; u !== null; ) {
          var f = La(u);
          if (f !== null)
            switch (f.tag) {
              case 3:
                if (((f = f.stateNode), f.current.memoizedState.isDehydrated)) {
                  var y = En(f.pendingLanes);
                  if (y !== 0) {
                    var x = f;
                    for (x.pendingLanes |= 2, x.entangledLanes |= 2; y; ) {
                      var _ = 1 << (31 - bt(y));
                      ((x.entanglements[1] |= _), (y &= ~_));
                    }
                    (_n(f), (Le & 6) === 0 && ((ko = Tt() + 500), pl(0)));
                  }
                }
                break;
              case 31:
              case 13:
                ((x = ia(f, 2)), x !== null && qt(x, f, 2), Vo(), pf(f, 2));
            }
          if (((f = yf(l)), f === null && tf(e, t, l, is, r), f === u)) break;
          u = f;
        }
        u !== null && l.stopPropagation();
      } else tf(e, t, l, null, r);
    }
  }
  function yf(e) {
    return ((e = gu(e)), gf(e));
  }
  var is = null;
  function gf(e) {
    if (((is = null), (e = Ua(e)), e !== null)) {
      var t = c(e);
      if (t === null) e = null;
      else {
        var r = t.tag;
        if (r === 13) {
          if (((e = d(t)), e !== null)) return e;
          e = null;
        } else if (r === 31) {
          if (((e = h(t)), e !== null)) return e;
          e = null;
        } else if (r === 3) {
          if (t.stateNode.current.memoizedState.isDehydrated)
            return t.tag === 3 ? t.stateNode.containerInfo : null;
          e = null;
        } else t !== e && (e = null);
      }
    }
    return ((is = e), null);
  }
  function zv(e) {
    switch (e) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (su()) {
          case Fr:
            return 2;
          case Fl:
            return 8;
          case $r:
          case zi:
            return 32;
          case Hn:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var bf = !1,
    Nr = null,
    Dr = null,
    jr = null,
    wl = new Map(),
    El = new Map(),
    zr = [],
    x1 =
      "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
        " ",
      );
  function Uv(e, t) {
    switch (e) {
      case "focusin":
      case "focusout":
        Nr = null;
        break;
      case "dragenter":
      case "dragleave":
        Dr = null;
        break;
      case "mouseover":
      case "mouseout":
        jr = null;
        break;
      case "pointerover":
      case "pointerout":
        wl.delete(t.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        El.delete(t.pointerId);
    }
  }
  function Ol(e, t, r, l, u, f) {
    return e === null || e.nativeEvent !== f
      ? ((e = {
          blockedOn: t,
          domEventName: r,
          eventSystemFlags: l,
          nativeEvent: f,
          targetContainers: [u],
        }),
        t !== null && ((t = La(t)), t !== null && Dv(t)),
        e)
      : ((e.eventSystemFlags |= l),
        (t = e.targetContainers),
        u !== null && t.indexOf(u) === -1 && t.push(u),
        e);
  }
  function S1(e, t, r, l, u) {
    switch (t) {
      case "focusin":
        return ((Nr = Ol(Nr, e, t, r, l, u)), !0);
      case "dragenter":
        return ((Dr = Ol(Dr, e, t, r, l, u)), !0);
      case "mouseover":
        return ((jr = Ol(jr, e, t, r, l, u)), !0);
      case "pointerover":
        var f = u.pointerId;
        return (wl.set(f, Ol(wl.get(f) || null, e, t, r, l, u)), !0);
      case "gotpointercapture":
        return (
          (f = u.pointerId),
          El.set(f, Ol(El.get(f) || null, e, t, r, l, u)),
          !0
        );
    }
    return !1;
  }
  function Lv(e) {
    var t = Ua(e.target);
    if (t !== null) {
      var r = c(t);
      if (r !== null) {
        if (((t = r.tag), t === 13)) {
          if (((t = d(r)), t !== null)) {
            ((e.blockedOn = t),
              Fd(e.priority, function () {
                jv(r);
              }));
            return;
          }
        } else if (t === 31) {
          if (((t = h(r)), t !== null)) {
            ((e.blockedOn = t),
              Fd(e.priority, function () {
                jv(r);
              }));
            return;
          }
        } else if (t === 3 && r.stateNode.current.memoizedState.isDehydrated) {
          e.blockedOn = r.tag === 3 ? r.stateNode.containerInfo : null;
          return;
        }
      }
    }
    e.blockedOn = null;
  }
  function ls(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
      var r = yf(e.nativeEvent);
      if (r === null) {
        r = e.nativeEvent;
        var l = new r.constructor(r.type, r);
        ((yu = l), r.target.dispatchEvent(l), (yu = null));
      } else return ((t = La(r)), t !== null && Dv(t), (e.blockedOn = r), !1);
      t.shift();
    }
    return !0;
  }
  function Hv(e, t, r) {
    ls(e) && r.delete(t);
  }
  function w1() {
    ((bf = !1),
      Nr !== null && ls(Nr) && (Nr = null),
      Dr !== null && ls(Dr) && (Dr = null),
      jr !== null && ls(jr) && (jr = null),
      wl.forEach(Hv),
      El.forEach(Hv));
  }
  function os(e, t) {
    e.blockedOn === t &&
      ((e.blockedOn = null),
      bf ||
        ((bf = !0),
        n.unstable_scheduleCallback(n.unstable_NormalPriority, w1)));
  }
  var ss = null;
  function Bv(e) {
    ss !== e &&
      ((ss = e),
      n.unstable_scheduleCallback(n.unstable_NormalPriority, function () {
        ss === e && (ss = null);
        for (var t = 0; t < e.length; t += 3) {
          var r = e[t],
            l = e[t + 1],
            u = e[t + 2];
          if (typeof l != "function") {
            if (gf(l || r) === null) continue;
            break;
          }
          var f = La(r);
          f !== null &&
            (e.splice(t, 3),
            (t -= 3),
            vc(f, { pending: !0, data: u, method: r.method, action: l }, l, u));
        }
      }));
  }
  function yi(e) {
    function t(_) {
      return os(_, e);
    }
    (Nr !== null && os(Nr, e),
      Dr !== null && os(Dr, e),
      jr !== null && os(jr, e),
      wl.forEach(t),
      El.forEach(t));
    for (var r = 0; r < zr.length; r++) {
      var l = zr[r];
      l.blockedOn === e && (l.blockedOn = null);
    }
    for (; 0 < zr.length && ((r = zr[0]), r.blockedOn === null); )
      (Lv(r), r.blockedOn === null && zr.shift());
    if (((r = (e.ownerDocument || e).$$reactFormReplay), r != null))
      for (l = 0; l < r.length; l += 3) {
        var u = r[l],
          f = r[l + 1],
          y = u[jt] || null;
        if (typeof f == "function") y || Bv(r);
        else if (y) {
          var x = null;
          if (f && f.hasAttribute("formAction")) {
            if (((u = f), (y = f[jt] || null))) x = y.formAction;
            else if (gf(u) !== null) continue;
          } else x = y.action;
          (typeof x == "function" ? (r[l + 1] = x) : (r.splice(l, 3), (l -= 3)),
            Bv(r));
        }
      }
  }
  function qv() {
    function e(f) {
      f.canIntercept &&
        f.info === "react-transition" &&
        f.intercept({
          handler: function () {
            return new Promise(function (y) {
              return (u = y);
            });
          },
          focusReset: "manual",
          scroll: "manual",
        });
    }
    function t() {
      (u !== null && (u(), (u = null)), l || setTimeout(r, 20));
    }
    function r() {
      if (!l && !navigation.transition) {
        var f = navigation.currentEntry;
        f &&
          f.url != null &&
          navigation.navigate(f.url, {
            state: f.getState(),
            info: "react-transition",
            history: "replace",
          });
      }
    }
    if (typeof navigation == "object") {
      var l = !1,
        u = null;
      return (
        navigation.addEventListener("navigate", e),
        navigation.addEventListener("navigatesuccess", t),
        navigation.addEventListener("navigateerror", t),
        setTimeout(r, 100),
        function () {
          ((l = !0),
            navigation.removeEventListener("navigate", e),
            navigation.removeEventListener("navigatesuccess", t),
            navigation.removeEventListener("navigateerror", t),
            u !== null && (u(), (u = null)));
        }
      );
    }
  }
  function xf(e) {
    this._internalRoot = e;
  }
  ((us.prototype.render = xf.prototype.render =
    function (e) {
      var t = this._internalRoot;
      if (t === null) throw Error(o(409));
      var r = t.current,
        l = It();
      Mv(r, l, e, t, null, null);
    }),
    (us.prototype.unmount = xf.prototype.unmount =
      function () {
        var e = this._internalRoot;
        if (e !== null) {
          this._internalRoot = null;
          var t = e.containerInfo;
          (Mv(e.current, 2, null, e, null, null), Vo(), (t[za] = null));
        }
      }));
  function us(e) {
    this._internalRoot = e;
  }
  us.prototype.unstable_scheduleHydration = function (e) {
    if (e) {
      var t = cu();
      e = { blockedOn: null, target: e, priority: t };
      for (var r = 0; r < zr.length && t !== 0 && t < zr[r].priority; r++);
      (zr.splice(r, 0, e), r === 0 && Lv(e));
    }
  };
  var Pv = a.version;
  if (Pv !== "19.2.4") throw Error(o(527, Pv, "19.2.4"));
  B.findDOMNode = function (e) {
    var t = e._reactInternals;
    if (t === void 0)
      throw typeof e.render == "function"
        ? Error(o(188))
        : ((e = Object.keys(e).join(",")), Error(o(268, e)));
    return (
      (e = p(t)),
      (e = e !== null ? g(e) : null),
      (e = e === null ? null : e.stateNode),
      e
    );
  };
  var E1 = {
    bundleType: 0,
    version: "19.2.4",
    rendererPackageName: "react-dom",
    currentDispatcherRef: A,
    reconcilerVersion: "19.2.4",
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var cs = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!cs.isDisabled && cs.supportsFiber)
      try {
        ((Jr = cs.inject(E1)), (_t = cs));
      } catch {}
  }
  return (
    (_l.createRoot = function (e, t) {
      if (!s(e)) throw Error(o(299));
      var r = !1,
        l = "",
        u = Xm,
        f = Im,
        y = Zm;
      return (
        t != null &&
          (t.unstable_strictMode === !0 && (r = !0),
          t.identifierPrefix !== void 0 && (l = t.identifierPrefix),
          t.onUncaughtError !== void 0 && (u = t.onUncaughtError),
          t.onCaughtError !== void 0 && (f = t.onCaughtError),
          t.onRecoverableError !== void 0 && (y = t.onRecoverableError)),
        (t = Av(e, 1, !1, null, null, r, l, null, u, f, y, qv)),
        (e[za] = t.current),
        ef(e),
        new xf(t)
      );
    }),
    (_l.hydrateRoot = function (e, t, r) {
      if (!s(e)) throw Error(o(299));
      var l = !1,
        u = "",
        f = Xm,
        y = Im,
        x = Zm,
        _ = null;
      return (
        r != null &&
          (r.unstable_strictMode === !0 && (l = !0),
          r.identifierPrefix !== void 0 && (u = r.identifierPrefix),
          r.onUncaughtError !== void 0 && (f = r.onUncaughtError),
          r.onCaughtError !== void 0 && (y = r.onCaughtError),
          r.onRecoverableError !== void 0 && (x = r.onRecoverableError),
          r.formState !== void 0 && (_ = r.formState)),
        (t = Av(e, 1, !0, t, r ?? null, l, u, _, f, y, x, qv)),
        (t.context = Rv(null)),
        (r = t.current),
        (l = It()),
        (l = ja(l)),
        (u = br(l)),
        (u.callback = null),
        xr(r, u, l),
        (r = l),
        (t.current.lanes = r),
        Ze(t, r),
        _n(t),
        (e[za] = t.current),
        ef(e),
        new us(t)
      );
    }),
    (_l.version = "19.2.4"),
    _l
  );
}
var hy;
function QE() {
  if (hy) return _f.exports;
  hy = 1;
  function n() {
    if (
      !(
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" ||
        typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"
      )
    )
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (a) {
        console.error(a);
      }
  }
  return (n(), (_f.exports = kE()), _f.exports);
}
var VE = QE(),
  YE = (function () {
    function n() {
      ((this.keyToValue = new Map()), (this.valueToKey = new Map()));
    }
    return (
      (n.prototype.set = function (a, i) {
        (this.keyToValue.set(a, i), this.valueToKey.set(i, a));
      }),
      (n.prototype.getByKey = function (a) {
        return this.keyToValue.get(a);
      }),
      (n.prototype.getByValue = function (a) {
        return this.valueToKey.get(a);
      }),
      (n.prototype.clear = function () {
        (this.keyToValue.clear(), this.valueToKey.clear());
      }),
      n
    );
  })(),
  Wg = (function () {
    function n(a) {
      ((this.generateIdentifier = a), (this.kv = new YE()));
    }
    return (
      (n.prototype.register = function (a, i) {
        this.kv.getByValue(a) ||
          (i || (i = this.generateIdentifier(a)), this.kv.set(i, a));
      }),
      (n.prototype.clear = function () {
        this.kv.clear();
      }),
      (n.prototype.getIdentifier = function (a) {
        return this.kv.getByValue(a);
      }),
      (n.prototype.getValue = function (a) {
        return this.kv.getByKey(a);
      }),
      n
    );
  })(),
  GE = (function () {
    var n = function (a, i) {
      return (
        (n =
          Object.setPrototypeOf ||
          ({ __proto__: [] } instanceof Array &&
            function (o, s) {
              o.__proto__ = s;
            }) ||
          function (o, s) {
            for (var c in s)
              Object.prototype.hasOwnProperty.call(s, c) && (o[c] = s[c]);
          }),
        n(a, i)
      );
    };
    return function (a, i) {
      if (typeof i != "function" && i !== null)
        throw new TypeError(
          "Class extends value " + String(i) + " is not a constructor or null",
        );
      n(a, i);
      function o() {
        this.constructor = a;
      }
      a.prototype =
        i === null ? Object.create(i) : ((o.prototype = i.prototype), new o());
    };
  })(),
  KE = (function (n) {
    GE(a, n);
    function a() {
      var i =
        n.call(this, function (o) {
          return o.name;
        }) || this;
      return ((i.classToAllowedProps = new Map()), i);
    }
    return (
      (a.prototype.register = function (i, o) {
        typeof o == "object"
          ? (o.allowProps && this.classToAllowedProps.set(i, o.allowProps),
            n.prototype.register.call(this, i, o.identifier))
          : n.prototype.register.call(this, i, o);
      }),
      (a.prototype.getAllowedProps = function (i) {
        return this.classToAllowedProps.get(i);
      }),
      a
    );
  })(Wg),
  XE = function (n, a) {
    var i = typeof Symbol == "function" && n[Symbol.iterator];
    if (!i) return n;
    var o = i.call(n),
      s,
      c = [],
      d;
    try {
      for (; (a === void 0 || a-- > 0) && !(s = o.next()).done; )
        c.push(s.value);
    } catch (h) {
      d = { error: h };
    } finally {
      try {
        s && !s.done && (i = o.return) && i.call(o);
      } finally {
        if (d) throw d.error;
      }
    }
    return c;
  };
function IE(n) {
  if ("values" in Object) return Object.values(n);
  var a = [];
  for (var i in n) n.hasOwnProperty(i) && a.push(n[i]);
  return a;
}
function ZE(n, a) {
  var i = IE(n);
  if ("find" in i) return i.find(a);
  for (var o = i, s = 0; s < o.length; s++) {
    var c = o[s];
    if (a(c)) return c;
  }
}
function Ci(n, a) {
  Object.entries(n).forEach(function (i) {
    var o = XE(i, 2),
      s = o[0],
      c = o[1];
    return a(c, s);
  });
}
function _s(n, a) {
  return n.indexOf(a) !== -1;
}
function my(n, a) {
  for (var i = 0; i < n.length; i++) {
    var o = n[i];
    if (a(o)) return o;
  }
}
var FE = (function () {
    function n() {
      this.transfomers = {};
    }
    return (
      (n.prototype.register = function (a) {
        this.transfomers[a.name] = a;
      }),
      (n.prototype.findApplicable = function (a) {
        return ZE(this.transfomers, function (i) {
          return i.isApplicable(a);
        });
      }),
      (n.prototype.findByName = function (a) {
        return this.transfomers[a];
      }),
      n
    );
  })(),
  $E = function (n) {
    return Object.prototype.toString.call(n).slice(8, -1);
  },
  e0 = function (n) {
    return typeof n > "u";
  },
  JE = function (n) {
    return n === null;
  },
  Hl = function (n) {
    return typeof n != "object" || n === null || n === Object.prototype
      ? !1
      : Object.getPrototypeOf(n) === null
        ? !0
        : Object.getPrototypeOf(n) === Object.prototype;
  },
  nd = function (n) {
    return Hl(n) && Object.keys(n).length === 0;
  },
  Vr = function (n) {
    return Array.isArray(n);
  },
  WE = function (n) {
    return typeof n == "string";
  },
  eO = function (n) {
    return typeof n == "number" && !isNaN(n);
  },
  tO = function (n) {
    return typeof n == "boolean";
  },
  nO = function (n) {
    return n instanceof RegExp;
  },
  Bl = function (n) {
    return n instanceof Map;
  },
  ql = function (n) {
    return n instanceof Set;
  },
  t0 = function (n) {
    return $E(n) === "Symbol";
  },
  rO = function (n) {
    return n instanceof Date && !isNaN(n.valueOf());
  },
  aO = function (n) {
    return n instanceof Error;
  },
  py = function (n) {
    return typeof n == "number" && isNaN(n);
  },
  iO = function (n) {
    return tO(n) || JE(n) || e0(n) || eO(n) || WE(n) || t0(n);
  },
  lO = function (n) {
    return typeof n == "bigint";
  },
  oO = function (n) {
    return n === 1 / 0 || n === -1 / 0;
  },
  sO = function (n) {
    return ArrayBuffer.isView(n) && !(n instanceof DataView);
  },
  uO = function (n) {
    return n instanceof URL;
  },
  n0 = function (n) {
    return n.replace(/\./g, "\\.");
  },
  Nf = function (n) {
    return n.map(String).map(n0).join(".");
  },
  Dl = function (n) {
    for (var a = [], i = "", o = 0; o < n.length; o++) {
      var s = n.charAt(o),
        c = s === "\\" && n.charAt(o + 1) === ".";
      if (c) {
        ((i += "."), o++);
        continue;
      }
      var d = s === ".";
      if (d) {
        (a.push(i), (i = ""));
        continue;
      }
      i += s;
    }
    var h = i;
    return (a.push(h), a);
  },
  rd = function () {
    return (
      (rd =
        Object.assign ||
        function (n) {
          for (var a, i = 1, o = arguments.length; i < o; i++) {
            a = arguments[i];
            for (var s in a)
              Object.prototype.hasOwnProperty.call(a, s) && (n[s] = a[s]);
          }
          return n;
        }),
      rd.apply(this, arguments)
    );
  },
  ad = function (n, a) {
    var i = typeof Symbol == "function" && n[Symbol.iterator];
    if (!i) return n;
    var o = i.call(n),
      s,
      c = [],
      d;
    try {
      for (; (a === void 0 || a-- > 0) && !(s = o.next()).done; )
        c.push(s.value);
    } catch (h) {
      d = { error: h };
    } finally {
      try {
        s && !s.done && (i = o.return) && i.call(o);
      } finally {
        if (d) throw d.error;
      }
    }
    return c;
  },
  id = function (n, a) {
    for (var i = 0, o = a.length, s = n.length; i < o; i++, s++) n[s] = a[i];
    return n;
  };
function An(n, a, i, o) {
  return { isApplicable: n, annotation: a, transform: i, untransform: o };
}
var r0 = [
  An(
    e0,
    "undefined",
    function () {
      return null;
    },
    function () {},
  ),
  An(
    lO,
    "bigint",
    function (n) {
      return n.toString();
    },
    function (n) {
      return typeof BigInt < "u"
        ? BigInt(n)
        : (console.error("Please add a BigInt polyfill."), n);
    },
  ),
  An(
    rO,
    "Date",
    function (n) {
      return n.toISOString();
    },
    function (n) {
      return new Date(n);
    },
  ),
  An(
    aO,
    "Error",
    function (n, a) {
      var i = { name: n.name, message: n.message };
      return (
        a.allowedErrorProps.forEach(function (o) {
          i[o] = n[o];
        }),
        i
      );
    },
    function (n, a) {
      var i = new Error(n.message);
      return (
        (i.name = n.name),
        (i.stack = n.stack),
        a.allowedErrorProps.forEach(function (o) {
          i[o] = n[o];
        }),
        i
      );
    },
  ),
  An(
    nO,
    "regexp",
    function (n) {
      return "" + n;
    },
    function (n) {
      var a = n.slice(1, n.lastIndexOf("/")),
        i = n.slice(n.lastIndexOf("/") + 1);
      return new RegExp(a, i);
    },
  ),
  An(
    ql,
    "set",
    function (n) {
      return id([], ad(n.values()));
    },
    function (n) {
      return new Set(n);
    },
  ),
  An(
    Bl,
    "map",
    function (n) {
      return id([], ad(n.entries()));
    },
    function (n) {
      return new Map(n);
    },
  ),
  An(
    function (n) {
      return py(n) || oO(n);
    },
    "number",
    function (n) {
      return py(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity";
    },
    Number,
  ),
  An(
    function (n) {
      return n === 0 && 1 / n === -1 / 0;
    },
    "number",
    function () {
      return "-0";
    },
    Number,
  ),
  An(
    uO,
    "URL",
    function (n) {
      return n.toString();
    },
    function (n) {
      return new URL(n);
    },
  ),
];
function Is(n, a, i, o) {
  return { isApplicable: n, annotation: a, transform: i, untransform: o };
}
var a0 = Is(
    function (n, a) {
      if (t0(n)) {
        var i = !!a.symbolRegistry.getIdentifier(n);
        return i;
      }
      return !1;
    },
    function (n, a) {
      var i = a.symbolRegistry.getIdentifier(n);
      return ["symbol", i];
    },
    function (n) {
      return n.description;
    },
    function (n, a, i) {
      var o = i.symbolRegistry.getValue(a[1]);
      if (!o) throw new Error("Trying to deserialize unknown symbol");
      return o;
    },
  ),
  cO = [
    Int8Array,
    Uint8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    Uint8ClampedArray,
  ].reduce(function (n, a) {
    return ((n[a.name] = a), n);
  }, {}),
  i0 = Is(
    sO,
    function (n) {
      return ["typed-array", n.constructor.name];
    },
    function (n) {
      return id([], ad(n));
    },
    function (n, a) {
      var i = cO[a[1]];
      if (!i) throw new Error("Trying to deserialize unknown typed array");
      return new i(n);
    },
  );
function l0(n, a) {
  if (n?.constructor) {
    var i = !!a.classRegistry.getIdentifier(n.constructor);
    return i;
  }
  return !1;
}
var o0 = Is(
    l0,
    function (n, a) {
      var i = a.classRegistry.getIdentifier(n.constructor);
      return ["class", i];
    },
    function (n, a) {
      var i = a.classRegistry.getAllowedProps(n.constructor);
      if (!i) return rd({}, n);
      var o = {};
      return (
        i.forEach(function (s) {
          o[s] = n[s];
        }),
        o
      );
    },
    function (n, a, i) {
      var o = i.classRegistry.getValue(a[1]);
      if (!o)
        throw new Error(
          "Trying to deserialize unknown class - check https://github.com/blitz-js/superjson/issues/116#issuecomment-773996564",
        );
      return Object.assign(Object.create(o.prototype), n);
    },
  ),
  s0 = Is(
    function (n, a) {
      return !!a.customTransformerRegistry.findApplicable(n);
    },
    function (n, a) {
      var i = a.customTransformerRegistry.findApplicable(n);
      return ["custom", i.name];
    },
    function (n, a) {
      var i = a.customTransformerRegistry.findApplicable(n);
      return i.serialize(n);
    },
    function (n, a, i) {
      var o = i.customTransformerRegistry.findByName(a[1]);
      if (!o) throw new Error("Trying to deserialize unknown custom value");
      return o.deserialize(n);
    },
  ),
  fO = [o0, a0, s0, i0],
  vy = function (n, a) {
    var i = my(fO, function (s) {
      return s.isApplicable(n, a);
    });
    if (i) return { value: i.transform(n, a), type: i.annotation(n, a) };
    var o = my(r0, function (s) {
      return s.isApplicable(n, a);
    });
    if (o) return { value: o.transform(n, a), type: o.annotation };
  },
  u0 = {};
r0.forEach(function (n) {
  u0[n.annotation] = n;
});
var dO = function (n, a, i) {
    if (Vr(a))
      switch (a[0]) {
        case "symbol":
          return a0.untransform(n, a, i);
        case "class":
          return o0.untransform(n, a, i);
        case "custom":
          return s0.untransform(n, a, i);
        case "typed-array":
          return i0.untransform(n, a, i);
        default:
          throw new Error("Unknown transformation: " + a);
      }
    else {
      var o = u0[a];
      if (!o) throw new Error("Unknown transformation: " + a);
      return o.untransform(n, i);
    }
  },
  wi = function (n, a) {
    for (var i = n.keys(); a > 0; ) (i.next(), a--);
    return i.next().value;
  };
function c0(n) {
  if (_s(n, "__proto__"))
    throw new Error("__proto__ is not allowed as a property");
  if (_s(n, "prototype"))
    throw new Error("prototype is not allowed as a property");
  if (_s(n, "constructor"))
    throw new Error("constructor is not allowed as a property");
}
var hO = function (n, a) {
    c0(a);
    for (var i = 0; i < a.length; i++) {
      var o = a[i];
      if (ql(n)) n = wi(n, +o);
      else if (Bl(n)) {
        var s = +o,
          c = +a[++i] == 0 ? "key" : "value",
          d = wi(n, s);
        switch (c) {
          case "key":
            n = d;
            break;
          case "value":
            n = n.get(d);
            break;
        }
      } else n = n[o];
    }
    return n;
  },
  ld = function (n, a, i) {
    if ((c0(a), a.length === 0)) return i(n);
    for (var o = n, s = 0; s < a.length - 1; s++) {
      var c = a[s];
      if (Vr(o)) {
        var d = +c;
        o = o[d];
      } else if (Hl(o)) o = o[c];
      else if (ql(o)) {
        var h = +c;
        o = wi(o, h);
      } else if (Bl(o)) {
        var m = s === a.length - 2;
        if (m) break;
        var h = +c,
          p = +a[++s] == 0 ? "key" : "value",
          g = wi(o, h);
        switch (p) {
          case "key":
            o = g;
            break;
          case "value":
            o = o.get(g);
            break;
        }
      }
    }
    var v = a[a.length - 1];
    if ((Vr(o) ? (o[+v] = i(o[+v])) : Hl(o) && (o[v] = i(o[v])), ql(o))) {
      var w = wi(o, +v),
        E = i(w);
      w !== E && (o.delete(w), o.add(E));
    }
    if (Bl(o)) {
      var h = +a[a.length - 2],
        C = wi(o, h),
        p = +v == 0 ? "key" : "value";
      switch (p) {
        case "key": {
          var S = i(C);
          (o.set(S, o.get(C)), S !== C && o.delete(C));
          break;
        }
        case "value": {
          o.set(C, i(o.get(C)));
          break;
        }
      }
    }
    return n;
  },
  ar = function (n, a) {
    var i = typeof Symbol == "function" && n[Symbol.iterator];
    if (!i) return n;
    var o = i.call(n),
      s,
      c = [],
      d;
    try {
      for (; (a === void 0 || a-- > 0) && !(s = o.next()).done; )
        c.push(s.value);
    } catch (h) {
      d = { error: h };
    } finally {
      try {
        s && !s.done && (i = o.return) && i.call(o);
      } finally {
        if (d) throw d.error;
      }
    }
    return c;
  },
  Pr = function (n, a) {
    for (var i = 0, o = a.length, s = n.length; i < o; i++, s++) n[s] = a[i];
    return n;
  };
function od(n, a, i) {
  if ((i === void 0 && (i = []), !!n)) {
    if (!Vr(n)) {
      Ci(n, function (d, h) {
        return od(d, a, Pr(Pr([], ar(i)), ar(Dl(h))));
      });
      return;
    }
    var o = ar(n, 2),
      s = o[0],
      c = o[1];
    (c &&
      Ci(c, function (d, h) {
        od(d, a, Pr(Pr([], ar(i)), ar(Dl(h))));
      }),
      a(s, i));
  }
}
function mO(n, a, i) {
  return (
    od(a, function (o, s) {
      n = ld(n, s, function (c) {
        return dO(c, o, i);
      });
    }),
    n
  );
}
function pO(n, a) {
  function i(d, h) {
    var m = hO(n, Dl(h));
    d.map(Dl).forEach(function (p) {
      n = ld(n, p, function () {
        return m;
      });
    });
  }
  if (Vr(a)) {
    var o = ar(a, 2),
      s = o[0],
      c = o[1];
    (s.forEach(function (d) {
      n = ld(n, Dl(d), function () {
        return n;
      });
    }),
      c && Ci(c, i));
  } else Ci(a, i);
  return n;
}
var vO = function (n, a) {
  return Hl(n) || Vr(n) || Bl(n) || ql(n) || l0(n, a);
};
function yO(n, a, i) {
  var o = i.get(n);
  o ? o.push(a) : i.set(n, [a]);
}
function gO(n, a) {
  var i = {},
    o = void 0;
  return (
    n.forEach(function (s) {
      if (!(s.length <= 1)) {
        a ||
          (s = s
            .map(function (m) {
              return m.map(String);
            })
            .sort(function (m, p) {
              return m.length - p.length;
            }));
        var c = ar(s),
          d = c[0],
          h = c.slice(1);
        d.length === 0 ? (o = h.map(Nf)) : (i[Nf(d)] = h.map(Nf));
      }
    }),
    o ? (nd(i) ? [o] : [o, i]) : nd(i) ? void 0 : i
  );
}
var f0 = function (n, a, i, o, s, c, d) {
  var h;
  (s === void 0 && (s = []),
    c === void 0 && (c = []),
    d === void 0 && (d = new Map()));
  var m = iO(n);
  if (!m) {
    yO(n, s, a);
    var p = d.get(n);
    if (p) return o ? { transformedValue: null } : p;
  }
  if (!vO(n, i)) {
    var g = vy(n, i),
      v = g
        ? { transformedValue: g.value, annotations: [g.type] }
        : { transformedValue: n };
    return (m || d.set(n, v), v);
  }
  if (_s(c, n)) return { transformedValue: null };
  var w = vy(n, i),
    E = (h = w?.value) !== null && h !== void 0 ? h : n,
    C = Vr(E) ? [] : {},
    S = {};
  Ci(E, function (M, j) {
    var q = f0(M, a, i, o, Pr(Pr([], ar(s)), [j]), Pr(Pr([], ar(c)), [n]), d);
    ((C[j] = q.transformedValue),
      Vr(q.annotations)
        ? (S[j] = q.annotations)
        : Hl(q.annotations) &&
          Ci(q.annotations, function (Z, Q) {
            S[n0(j) + "." + Q] = Z;
          }));
  });
  var R = nd(S)
    ? { transformedValue: C, annotations: w ? [w.type] : void 0 }
    : { transformedValue: C, annotations: w ? [w.type, S] : S };
  return (m || d.set(n, R), R);
};
function d0(n) {
  return Object.prototype.toString.call(n).slice(8, -1);
}
function yy(n) {
  return d0(n) === "Array";
}
function bO(n) {
  if (d0(n) !== "Object") return !1;
  const a = Object.getPrototypeOf(n);
  return !!a && a.constructor === Object && a === Object.prototype;
}
function xO(n, a, i, o, s) {
  const c = {}.propertyIsEnumerable.call(o, a) ? "enumerable" : "nonenumerable";
  (c === "enumerable" && (n[a] = i),
    s &&
      c === "nonenumerable" &&
      Object.defineProperty(n, a, {
        value: i,
        enumerable: !1,
        writable: !0,
        configurable: !0,
      }));
}
function sd(n, a = {}) {
  if (yy(n)) return n.map((s) => sd(s, a));
  if (!bO(n)) return n;
  const i = Object.getOwnPropertyNames(n),
    o = Object.getOwnPropertySymbols(n);
  return [...i, ...o].reduce((s, c) => {
    if (yy(a.props) && !a.props.includes(c)) return s;
    const d = n[c],
      h = sd(d, a);
    return (xO(s, c, h, n, a.nonenumerable), s);
  }, {});
}
var xa = function () {
    return (
      (xa =
        Object.assign ||
        function (n) {
          for (var a, i = 1, o = arguments.length; i < o; i++) {
            a = arguments[i];
            for (var s in a)
              Object.prototype.hasOwnProperty.call(a, s) && (n[s] = a[s]);
          }
          return n;
        }),
      xa.apply(this, arguments)
    );
  },
  SO = function (n, a) {
    var i = typeof Symbol == "function" && n[Symbol.iterator];
    if (!i) return n;
    var o = i.call(n),
      s,
      c = [],
      d;
    try {
      for (; (a === void 0 || a-- > 0) && !(s = o.next()).done; )
        c.push(s.value);
    } catch (h) {
      d = { error: h };
    } finally {
      try {
        s && !s.done && (i = o.return) && i.call(o);
      } finally {
        if (d) throw d.error;
      }
    }
    return c;
  },
  wO = function (n, a) {
    for (var i = 0, o = a.length, s = n.length; i < o; i++, s++) n[s] = a[i];
    return n;
  },
  or = (function () {
    function n(a) {
      var i = a === void 0 ? {} : a,
        o = i.dedupe,
        s = o === void 0 ? !1 : o;
      ((this.classRegistry = new KE()),
        (this.symbolRegistry = new Wg(function (c) {
          var d;
          return (d = c.description) !== null && d !== void 0 ? d : "";
        })),
        (this.customTransformerRegistry = new FE()),
        (this.allowedErrorProps = []),
        (this.dedupe = s));
    }
    return (
      (n.prototype.serialize = function (a) {
        var i = new Map(),
          o = f0(a, i, this, this.dedupe),
          s = { json: o.transformedValue };
        o.annotations &&
          (s.meta = xa(xa({}, s.meta), { values: o.annotations }));
        var c = gO(i, this.dedupe);
        return (
          c && (s.meta = xa(xa({}, s.meta), { referentialEqualities: c })),
          s
        );
      }),
      (n.prototype.deserialize = function (a) {
        var i = a.json,
          o = a.meta,
          s = sd(i);
        return (
          o?.values && (s = mO(s, o.values, this)),
          o?.referentialEqualities && (s = pO(s, o.referentialEqualities)),
          s
        );
      }),
      (n.prototype.stringify = function (a) {
        return JSON.stringify(this.serialize(a));
      }),
      (n.prototype.parse = function (a) {
        return this.deserialize(JSON.parse(a));
      }),
      (n.prototype.registerClass = function (a, i) {
        this.classRegistry.register(a, i);
      }),
      (n.prototype.registerSymbol = function (a, i) {
        this.symbolRegistry.register(a, i);
      }),
      (n.prototype.registerCustom = function (a, i) {
        this.customTransformerRegistry.register(xa({ name: i }, a));
      }),
      (n.prototype.allowErrorProps = function () {
        for (var a, i = [], o = 0; o < arguments.length; o++)
          i[o] = arguments[o];
        (a = this.allowedErrorProps).push.apply(a, wO([], SO(i)));
      }),
      (n.defaultInstance = new n()),
      (n.serialize = n.defaultInstance.serialize.bind(n.defaultInstance)),
      (n.deserialize = n.defaultInstance.deserialize.bind(n.defaultInstance)),
      (n.stringify = n.defaultInstance.stringify.bind(n.defaultInstance)),
      (n.parse = n.defaultInstance.parse.bind(n.defaultInstance)),
      (n.registerClass = n.defaultInstance.registerClass.bind(
        n.defaultInstance,
      )),
      (n.registerSymbol = n.defaultInstance.registerSymbol.bind(
        n.defaultInstance,
      )),
      (n.registerCustom = n.defaultInstance.registerCustom.bind(
        n.defaultInstance,
      )),
      (n.allowErrorProps = n.defaultInstance.allowErrorProps.bind(
        n.defaultInstance,
      )),
      n
    );
  })();
or.serialize;
or.deserialize;
or.stringify;
or.parse;
or.registerClass;
or.registerCustom;
or.registerSymbol;
or.allowErrorProps;
var EO = (n, a, i, o, s, c, d, h) => {
    let m = document.documentElement,
      p = ["light", "dark"];
    function g(E) {
      ((Array.isArray(n) ? n : [n]).forEach((C) => {
        let S = C === "class",
          R = S && c ? s.map((M) => c[M] || M) : s;
        S
          ? (m.classList.remove(...R), m.classList.add(c && c[E] ? c[E] : E))
          : m.setAttribute(C, E);
      }),
        v(E));
    }
    function v(E) {
      h && p.includes(E) && (m.style.colorScheme = E);
    }
    function w() {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    if (o) g(o);
    else
      try {
        let E = localStorage.getItem(a) || i,
          C = d && E === "system" ? w() : E;
        g(C);
      } catch {}
  },
  OO = b.createContext(void 0),
  CO = { setTheme: (n) => {}, themes: [] },
  TO = () => {
    var n;
    return (n = b.useContext(OO)) != null ? n : CO;
  };
b.memo(
  ({
    forcedTheme: n,
    storageKey: a,
    attribute: i,
    enableSystem: o,
    enableColorScheme: s,
    defaultTheme: c,
    value: d,
    themes: h,
    nonce: m,
    scriptProps: p,
  }) => {
    let g = JSON.stringify([i, a, c, n, h, d, o, s]).slice(1, -1);
    return b.createElement("script", {
      ...p,
      suppressHydrationWarning: !0,
      nonce: typeof window > "u" ? m : "",
      dangerouslySetInnerHTML: { __html: `(${EO.toString()})(${g})` },
    });
  },
);
var Kl = Jg();
const h0 = hg(Kl);
function _O(n) {
  if (typeof document > "u") return;
  let a = document.head || document.getElementsByTagName("head")[0],
    i = document.createElement("style");
  ((i.type = "text/css"),
    a.appendChild(i),
    i.styleSheet
      ? (i.styleSheet.cssText = n)
      : i.appendChild(document.createTextNode(n)));
}
const AO = (n) => {
    switch (n) {
      case "success":
        return NO;
      case "info":
        return jO;
      case "warning":
        return DO;
      case "error":
        return zO;
      default:
        return null;
    }
  },
  RO = Array(12).fill(0),
  MO = ({ visible: n, className: a }) =>
    ie.createElement(
      "div",
      {
        className: ["sonner-loading-wrapper", a].filter(Boolean).join(" "),
        "data-visible": n,
      },
      ie.createElement(
        "div",
        { className: "sonner-spinner" },
        RO.map((i, o) =>
          ie.createElement("div", {
            className: "sonner-loading-bar",
            key: `spinner-bar-${o}`,
          }),
        ),
      ),
    ),
  NO = ie.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    ie.createElement("path", {
      fillRule: "evenodd",
      d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z",
      clipRule: "evenodd",
    }),
  ),
  DO = ie.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    ie.createElement("path", {
      fillRule: "evenodd",
      d: "M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z",
      clipRule: "evenodd",
    }),
  ),
  jO = ie.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    ie.createElement("path", {
      fillRule: "evenodd",
      d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z",
      clipRule: "evenodd",
    }),
  ),
  zO = ie.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    ie.createElement("path", {
      fillRule: "evenodd",
      d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z",
      clipRule: "evenodd",
    }),
  ),
  UO = ie.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    ie.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    ie.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
  ),
  LO = () => {
    const [n, a] = ie.useState(document.hidden);
    return (
      ie.useEffect(() => {
        const i = () => {
          a(document.hidden);
        };
        return (
          document.addEventListener("visibilitychange", i),
          () => window.removeEventListener("visibilitychange", i)
        );
      }, []),
      n
    );
  };
let ud = 1;
class HO {
  constructor() {
    ((this.subscribe = (a) => (
      this.subscribers.push(a),
      () => {
        const i = this.subscribers.indexOf(a);
        this.subscribers.splice(i, 1);
      }
    )),
      (this.publish = (a) => {
        this.subscribers.forEach((i) => i(a));
      }),
      (this.addToast = (a) => {
        (this.publish(a), (this.toasts = [...this.toasts, a]));
      }),
      (this.create = (a) => {
        var i;
        const { message: o, ...s } = a,
          c =
            typeof a?.id == "number" ||
            ((i = a.id) == null ? void 0 : i.length) > 0
              ? a.id
              : ud++,
          d = this.toasts.find((m) => m.id === c),
          h = a.dismissible === void 0 ? !0 : a.dismissible;
        return (
          this.dismissedToasts.has(c) && this.dismissedToasts.delete(c),
          d
            ? (this.toasts = this.toasts.map((m) =>
                m.id === c
                  ? (this.publish({ ...m, ...a, id: c, title: o }),
                    { ...m, ...a, id: c, dismissible: h, title: o })
                  : m,
              ))
            : this.addToast({ title: o, ...s, dismissible: h, id: c }),
          c
        );
      }),
      (this.dismiss = (a) => (
        a
          ? (this.dismissedToasts.add(a),
            requestAnimationFrame(() =>
              this.subscribers.forEach((i) => i({ id: a, dismiss: !0 })),
            ))
          : this.toasts.forEach((i) => {
              this.subscribers.forEach((o) => o({ id: i.id, dismiss: !0 }));
            }),
        a
      )),
      (this.message = (a, i) => this.create({ ...i, message: a })),
      (this.error = (a, i) => this.create({ ...i, message: a, type: "error" })),
      (this.success = (a, i) =>
        this.create({ ...i, type: "success", message: a })),
      (this.info = (a, i) => this.create({ ...i, type: "info", message: a })),
      (this.warning = (a, i) =>
        this.create({ ...i, type: "warning", message: a })),
      (this.loading = (a, i) =>
        this.create({ ...i, type: "loading", message: a })),
      (this.promise = (a, i) => {
        if (!i) return;
        let o;
        i.loading !== void 0 &&
          (o = this.create({
            ...i,
            promise: a,
            type: "loading",
            message: i.loading,
            description:
              typeof i.description != "function" ? i.description : void 0,
          }));
        const s = Promise.resolve(a instanceof Function ? a() : a);
        let c = o !== void 0,
          d;
        const h = s
            .then(async (p) => {
              if (((d = ["resolve", p]), ie.isValidElement(p)))
                ((c = !1), this.create({ id: o, type: "default", message: p }));
              else if (qO(p) && !p.ok) {
                c = !1;
                const v =
                    typeof i.error == "function"
                      ? await i.error(`HTTP error! status: ${p.status}`)
                      : i.error,
                  w =
                    typeof i.description == "function"
                      ? await i.description(`HTTP error! status: ${p.status}`)
                      : i.description,
                  C =
                    typeof v == "object" && !ie.isValidElement(v)
                      ? v
                      : { message: v };
                this.create({ id: o, type: "error", description: w, ...C });
              } else if (p instanceof Error) {
                c = !1;
                const v =
                    typeof i.error == "function" ? await i.error(p) : i.error,
                  w =
                    typeof i.description == "function"
                      ? await i.description(p)
                      : i.description,
                  C =
                    typeof v == "object" && !ie.isValidElement(v)
                      ? v
                      : { message: v };
                this.create({ id: o, type: "error", description: w, ...C });
              } else if (i.success !== void 0) {
                c = !1;
                const v =
                    typeof i.success == "function"
                      ? await i.success(p)
                      : i.success,
                  w =
                    typeof i.description == "function"
                      ? await i.description(p)
                      : i.description,
                  C =
                    typeof v == "object" && !ie.isValidElement(v)
                      ? v
                      : { message: v };
                this.create({ id: o, type: "success", description: w, ...C });
              }
            })
            .catch(async (p) => {
              if (((d = ["reject", p]), i.error !== void 0)) {
                c = !1;
                const g =
                    typeof i.error == "function" ? await i.error(p) : i.error,
                  v =
                    typeof i.description == "function"
                      ? await i.description(p)
                      : i.description,
                  E =
                    typeof g == "object" && !ie.isValidElement(g)
                      ? g
                      : { message: g };
                this.create({ id: o, type: "error", description: v, ...E });
              }
            })
            .finally(() => {
              (c && (this.dismiss(o), (o = void 0)),
                i.finally == null || i.finally.call(i));
            }),
          m = () =>
            new Promise((p, g) =>
              h.then(() => (d[0] === "reject" ? g(d[1]) : p(d[1]))).catch(g),
            );
        return typeof o != "string" && typeof o != "number"
          ? { unwrap: m }
          : Object.assign(o, { unwrap: m });
      }),
      (this.custom = (a, i) => {
        const o = i?.id || ud++;
        return (this.create({ jsx: a(o), id: o, ...i }), o);
      }),
      (this.getActiveToasts = () =>
        this.toasts.filter((a) => !this.dismissedToasts.has(a.id))),
      (this.subscribers = []),
      (this.toasts = []),
      (this.dismissedToasts = new Set()));
  }
}
const Pt = new HO(),
  BO = (n, a) => {
    const i = a?.id || ud++;
    return (Pt.addToast({ title: n, ...a, id: i }), i);
  },
  qO = (n) =>
    n &&
    typeof n == "object" &&
    "ok" in n &&
    typeof n.ok == "boolean" &&
    "status" in n &&
    typeof n.status == "number",
  PO = BO,
  kO = () => Pt.toasts,
  QO = () => Pt.getActiveToasts();
Object.assign(
  PO,
  {
    success: Pt.success,
    info: Pt.info,
    warning: Pt.warning,
    error: Pt.error,
    custom: Pt.custom,
    message: Pt.message,
    promise: Pt.promise,
    dismiss: Pt.dismiss,
    loading: Pt.loading,
  },
  { getHistory: kO, getToasts: QO },
);
_O(
  "[data-sonner-toaster][dir=ltr],html[dir=ltr]{--toast-icon-margin-start:-3px;--toast-icon-margin-end:4px;--toast-svg-margin-start:-1px;--toast-svg-margin-end:0px;--toast-button-margin-start:auto;--toast-button-margin-end:0;--toast-close-button-start:0;--toast-close-button-end:unset;--toast-close-button-transform:translate(-35%, -35%)}[data-sonner-toaster][dir=rtl],html[dir=rtl]{--toast-icon-margin-start:4px;--toast-icon-margin-end:-3px;--toast-svg-margin-start:0px;--toast-svg-margin-end:-1px;--toast-button-margin-start:0;--toast-button-margin-end:auto;--toast-close-button-start:unset;--toast-close-button-end:0;--toast-close-button-transform:translate(35%, -35%)}[data-sonner-toaster]{position:fixed;width:var(--width);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;--gray1:hsl(0, 0%, 99%);--gray2:hsl(0, 0%, 97.3%);--gray3:hsl(0, 0%, 95.1%);--gray4:hsl(0, 0%, 93%);--gray5:hsl(0, 0%, 90.9%);--gray6:hsl(0, 0%, 88.7%);--gray7:hsl(0, 0%, 85.8%);--gray8:hsl(0, 0%, 78%);--gray9:hsl(0, 0%, 56.1%);--gray10:hsl(0, 0%, 52.3%);--gray11:hsl(0, 0%, 43.5%);--gray12:hsl(0, 0%, 9%);--border-radius:8px;box-sizing:border-box;padding:0;margin:0;list-style:none;outline:0;z-index:999999999;transition:transform .4s ease}@media (hover:none) and (pointer:coarse){[data-sonner-toaster][data-lifted=true]{transform:none}}[data-sonner-toaster][data-x-position=right]{right:var(--offset-right)}[data-sonner-toaster][data-x-position=left]{left:var(--offset-left)}[data-sonner-toaster][data-x-position=center]{left:50%;transform:translateX(-50%)}[data-sonner-toaster][data-y-position=top]{top:var(--offset-top)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--offset-bottom)}[data-sonner-toast]{--y:translateY(100%);--lift-amount:calc(var(--lift) * var(--gap));z-index:var(--z-index);position:absolute;opacity:0;transform:var(--y);touch-action:none;transition:transform .4s,opacity .4s,height .4s,box-shadow .2s;box-sizing:border-box;outline:0;overflow-wrap:anywhere}[data-sonner-toast][data-styled=true]{padding:16px;background:var(--normal-bg);border:1px solid var(--normal-border);color:var(--normal-text);border-radius:var(--border-radius);box-shadow:0 4px 12px rgba(0,0,0,.1);width:var(--width);font-size:13px;display:flex;align-items:center;gap:6px}[data-sonner-toast]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-y-position=top]{top:0;--y:translateY(-100%);--lift:1;--lift-amount:calc(1 * var(--gap))}[data-sonner-toast][data-y-position=bottom]{bottom:0;--y:translateY(100%);--lift:-1;--lift-amount:calc(var(--lift) * var(--gap))}[data-sonner-toast][data-styled=true] [data-description]{font-weight:400;line-height:1.4;color:#3f3f3f}[data-rich-colors=true][data-sonner-toast][data-styled=true] [data-description]{color:inherit}[data-sonner-toaster][data-sonner-theme=dark] [data-description]{color:#e8e8e8}[data-sonner-toast][data-styled=true] [data-title]{font-weight:500;line-height:1.5;color:inherit}[data-sonner-toast][data-styled=true] [data-icon]{display:flex;height:16px;width:16px;position:relative;justify-content:flex-start;align-items:center;flex-shrink:0;margin-left:var(--toast-icon-margin-start);margin-right:var(--toast-icon-margin-end)}[data-sonner-toast][data-promise=true] [data-icon]>svg{opacity:0;transform:scale(.8);transform-origin:center;animation:sonner-fade-in .3s ease forwards}[data-sonner-toast][data-styled=true] [data-icon]>*{flex-shrink:0}[data-sonner-toast][data-styled=true] [data-icon] svg{margin-left:var(--toast-svg-margin-start);margin-right:var(--toast-svg-margin-end)}[data-sonner-toast][data-styled=true] [data-content]{display:flex;flex-direction:column;gap:2px}[data-sonner-toast][data-styled=true] [data-button]{border-radius:4px;padding-left:8px;padding-right:8px;height:24px;font-size:12px;color:var(--normal-bg);background:var(--normal-text);margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end);border:none;font-weight:500;cursor:pointer;outline:0;display:flex;align-items:center;flex-shrink:0;transition:opacity .4s,box-shadow .2s}[data-sonner-toast][data-styled=true] [data-button]:focus-visible{box-shadow:0 0 0 2px rgba(0,0,0,.4)}[data-sonner-toast][data-styled=true] [data-button]:first-of-type{margin-left:var(--toast-button-margin-start);margin-right:var(--toast-button-margin-end)}[data-sonner-toast][data-styled=true] [data-cancel]{color:var(--normal-text);background:rgba(0,0,0,.08)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-styled=true] [data-cancel]{background:rgba(255,255,255,.3)}[data-sonner-toast][data-styled=true] [data-close-button]{position:absolute;left:var(--toast-close-button-start);right:var(--toast-close-button-end);top:0;height:20px;width:20px;display:flex;justify-content:center;align-items:center;padding:0;color:var(--gray12);background:var(--normal-bg);border:1px solid var(--gray4);transform:var(--toast-close-button-transform);border-radius:50%;cursor:pointer;z-index:1;transition:opacity .1s,background .2s,border-color .2s}[data-sonner-toast][data-styled=true] [data-close-button]:focus-visible{box-shadow:0 4px 12px rgba(0,0,0,.1),0 0 0 2px rgba(0,0,0,.2)}[data-sonner-toast][data-styled=true] [data-disabled=true]{cursor:not-allowed}[data-sonner-toast][data-styled=true]:hover [data-close-button]:hover{background:var(--gray2);border-color:var(--gray5)}[data-sonner-toast][data-swiping=true]::before{content:'';position:absolute;left:-100%;right:-100%;height:100%;z-index:-1}[data-sonner-toast][data-y-position=top][data-swiping=true]::before{bottom:50%;transform:scaleY(3) translateY(50%)}[data-sonner-toast][data-y-position=bottom][data-swiping=true]::before{top:50%;transform:scaleY(3) translateY(-50%)}[data-sonner-toast][data-swiping=false][data-removed=true]::before{content:'';position:absolute;inset:0;transform:scaleY(2)}[data-sonner-toast][data-expanded=true]::after{content:'';position:absolute;left:0;height:calc(var(--gap) + 1px);bottom:100%;width:100%}[data-sonner-toast][data-mounted=true]{--y:translateY(0);opacity:1}[data-sonner-toast][data-expanded=false][data-front=false]{--scale:var(--toasts-before) * 0.05 + 1;--y:translateY(calc(var(--lift-amount) * var(--toasts-before))) scale(calc(-1 * var(--scale)));height:var(--front-toast-height)}[data-sonner-toast]>*{transition:opacity .4s}[data-sonner-toast][data-x-position=right]{right:0}[data-sonner-toast][data-x-position=left]{left:0}[data-sonner-toast][data-expanded=false][data-front=false][data-styled=true]>*{opacity:0}[data-sonner-toast][data-visible=false]{opacity:0;pointer-events:none}[data-sonner-toast][data-mounted=true][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset)));height:var(--initial-height)}[data-sonner-toast][data-removed=true][data-front=true][data-swipe-out=false]{--y:translateY(calc(var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=true]{--y:translateY(calc(var(--lift) * var(--offset) + var(--lift) * -100%));opacity:0}[data-sonner-toast][data-removed=true][data-front=false][data-swipe-out=false][data-expanded=false]{--y:translateY(40%);opacity:0;transition:transform .5s,opacity .2s}[data-sonner-toast][data-removed=true][data-front=false]::before{height:calc(var(--initial-height) + 20%)}[data-sonner-toast][data-swiping=true]{transform:var(--y) translateY(var(--swipe-amount-y,0)) translateX(var(--swipe-amount-x,0));transition:none}[data-sonner-toast][data-swiped=true]{user-select:none}[data-sonner-toast][data-swipe-out=true][data-y-position=bottom],[data-sonner-toast][data-swipe-out=true][data-y-position=top]{animation-duration:.2s;animation-timing-function:ease-out;animation-fill-mode:forwards}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=left]{animation-name:swipe-out-left}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=right]{animation-name:swipe-out-right}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=up]{animation-name:swipe-out-up}[data-sonner-toast][data-swipe-out=true][data-swipe-direction=down]{animation-name:swipe-out-down}@keyframes swipe-out-left{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) - 100%));opacity:0}}@keyframes swipe-out-right{from{transform:var(--y) translateX(var(--swipe-amount-x));opacity:1}to{transform:var(--y) translateX(calc(var(--swipe-amount-x) + 100%));opacity:0}}@keyframes swipe-out-up{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) - 100%));opacity:0}}@keyframes swipe-out-down{from{transform:var(--y) translateY(var(--swipe-amount-y));opacity:1}to{transform:var(--y) translateY(calc(var(--swipe-amount-y) + 100%));opacity:0}}@media (max-width:600px){[data-sonner-toaster]{position:fixed;right:var(--mobile-offset-right);left:var(--mobile-offset-left);width:100%}[data-sonner-toaster][dir=rtl]{left:calc(var(--mobile-offset-left) * -1)}[data-sonner-toaster] [data-sonner-toast]{left:0;right:0;width:calc(100% - var(--mobile-offset-left) * 2)}[data-sonner-toaster][data-x-position=left]{left:var(--mobile-offset-left)}[data-sonner-toaster][data-y-position=bottom]{bottom:var(--mobile-offset-bottom)}[data-sonner-toaster][data-y-position=top]{top:var(--mobile-offset-top)}[data-sonner-toaster][data-x-position=center]{left:var(--mobile-offset-left);right:var(--mobile-offset-right);transform:none}}[data-sonner-toaster][data-sonner-theme=light]{--normal-bg:#fff;--normal-border:var(--gray4);--normal-text:var(--gray12);--success-bg:hsl(143, 85%, 96%);--success-border:hsl(145, 92%, 87%);--success-text:hsl(140, 100%, 27%);--info-bg:hsl(208, 100%, 97%);--info-border:hsl(221, 91%, 93%);--info-text:hsl(210, 92%, 45%);--warning-bg:hsl(49, 100%, 97%);--warning-border:hsl(49, 91%, 84%);--warning-text:hsl(31, 92%, 45%);--error-bg:hsl(359, 100%, 97%);--error-border:hsl(359, 100%, 94%);--error-text:hsl(360, 100%, 45%)}[data-sonner-toaster][data-sonner-theme=light] [data-sonner-toast][data-invert=true]{--normal-bg:#000;--normal-border:hsl(0, 0%, 20%);--normal-text:var(--gray1)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast][data-invert=true]{--normal-bg:#fff;--normal-border:var(--gray3);--normal-text:var(--gray12)}[data-sonner-toaster][data-sonner-theme=dark]{--normal-bg:#000;--normal-bg-hover:hsl(0, 0%, 12%);--normal-border:hsl(0, 0%, 20%);--normal-border-hover:hsl(0, 0%, 25%);--normal-text:var(--gray1);--success-bg:hsl(150, 100%, 6%);--success-border:hsl(147, 100%, 12%);--success-text:hsl(150, 86%, 65%);--info-bg:hsl(215, 100%, 6%);--info-border:hsl(223, 43%, 17%);--info-text:hsl(216, 87%, 65%);--warning-bg:hsl(64, 100%, 6%);--warning-border:hsl(60, 100%, 9%);--warning-text:hsl(46, 87%, 65%);--error-bg:hsl(358, 76%, 10%);--error-border:hsl(357, 89%, 16%);--error-text:hsl(358, 100%, 81%)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]{background:var(--normal-bg);border-color:var(--normal-border);color:var(--normal-text)}[data-sonner-toaster][data-sonner-theme=dark] [data-sonner-toast] [data-close-button]:hover{background:var(--normal-bg-hover);border-color:var(--normal-border-hover)}[data-rich-colors=true][data-sonner-toast][data-type=success]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=success] [data-close-button]{background:var(--success-bg);border-color:var(--success-border);color:var(--success-text)}[data-rich-colors=true][data-sonner-toast][data-type=info]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=info] [data-close-button]{background:var(--info-bg);border-color:var(--info-border);color:var(--info-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=warning] [data-close-button]{background:var(--warning-bg);border-color:var(--warning-border);color:var(--warning-text)}[data-rich-colors=true][data-sonner-toast][data-type=error]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}[data-rich-colors=true][data-sonner-toast][data-type=error] [data-close-button]{background:var(--error-bg);border-color:var(--error-border);color:var(--error-text)}.sonner-loading-wrapper{--size:16px;height:var(--size);width:var(--size);position:absolute;inset:0;z-index:10}.sonner-loading-wrapper[data-visible=false]{transform-origin:center;animation:sonner-fade-out .2s ease forwards}.sonner-spinner{position:relative;top:50%;left:50%;height:var(--size);width:var(--size)}.sonner-loading-bar{animation:sonner-spin 1.2s linear infinite;background:var(--gray11);border-radius:6px;height:8%;left:-10%;position:absolute;top:-3.9%;width:24%}.sonner-loading-bar:first-child{animation-delay:-1.2s;transform:rotate(.0001deg) translate(146%)}.sonner-loading-bar:nth-child(2){animation-delay:-1.1s;transform:rotate(30deg) translate(146%)}.sonner-loading-bar:nth-child(3){animation-delay:-1s;transform:rotate(60deg) translate(146%)}.sonner-loading-bar:nth-child(4){animation-delay:-.9s;transform:rotate(90deg) translate(146%)}.sonner-loading-bar:nth-child(5){animation-delay:-.8s;transform:rotate(120deg) translate(146%)}.sonner-loading-bar:nth-child(6){animation-delay:-.7s;transform:rotate(150deg) translate(146%)}.sonner-loading-bar:nth-child(7){animation-delay:-.6s;transform:rotate(180deg) translate(146%)}.sonner-loading-bar:nth-child(8){animation-delay:-.5s;transform:rotate(210deg) translate(146%)}.sonner-loading-bar:nth-child(9){animation-delay:-.4s;transform:rotate(240deg) translate(146%)}.sonner-loading-bar:nth-child(10){animation-delay:-.3s;transform:rotate(270deg) translate(146%)}.sonner-loading-bar:nth-child(11){animation-delay:-.2s;transform:rotate(300deg) translate(146%)}.sonner-loading-bar:nth-child(12){animation-delay:-.1s;transform:rotate(330deg) translate(146%)}@keyframes sonner-fade-in{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}@keyframes sonner-fade-out{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.8)}}@keyframes sonner-spin{0%{opacity:1}100%{opacity:.15}}@media (prefers-reduced-motion){.sonner-loading-bar,[data-sonner-toast],[data-sonner-toast]>*{transition:none!important;animation:none!important}}.sonner-loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transform-origin:center;transition:opacity .2s,transform .2s}.sonner-loader[data-visible=false]{opacity:0;transform:scale(.8) translate(-50%,-50%)}",
);
function ps(n) {
  return n.label !== void 0;
}
const VO = 3,
  YO = "24px",
  GO = "16px",
  gy = 4e3,
  KO = 356,
  XO = 14,
  IO = 45,
  ZO = 200;
function Rn(...n) {
  return n.filter(Boolean).join(" ");
}
function FO(n) {
  const [a, i] = n.split("-"),
    o = [];
  return (a && o.push(a), i && o.push(i), o);
}
const $O = (n) => {
  var a, i, o, s, c, d, h, m, p;
  const {
      invert: g,
      toast: v,
      unstyled: w,
      interacting: E,
      setHeights: C,
      visibleToasts: S,
      heights: R,
      index: M,
      toasts: j,
      expanded: q,
      removeToast: Z,
      defaultRichColors: Q,
      closeButton: V,
      style: N,
      cancelButtonStyle: U,
      actionButtonStyle: W,
      className: ne = "",
      descriptionClassName: ae = "",
      duration: te,
      position: oe,
      gap: se,
      expandByDefault: ce,
      classNames: A,
      icons: B,
      closeButtonAriaLabel: K = "Close toast",
    } = n,
    [le, J] = ie.useState(null),
    [T, G] = ie.useState(null),
    [k, I] = ie.useState(!1),
    [ee, ue] = ie.useState(!1),
    [re, de] = ie.useState(!1),
    [pe, Oe] = ie.useState(!1),
    [Ce, Re] = ie.useState(!1),
    [et, Ke] = ie.useState(0),
    [Ln, Sn] = ie.useState(0),
    cn = ie.useRef(v.duration || te || gy),
    Ni = ie.useRef(null),
    kt = ie.useRef(null),
    Di = M === 0,
    ji = M + 1 <= S,
    Ct = v.type,
    ur = v.dismissible !== !1,
    Tt = v.className || "",
    su = v.descriptionClassName || "",
    Fr = ie.useMemo(
      () => R.findIndex((xe) => xe.toastId === v.id) || 0,
      [R, v.id],
    ),
    Fl = ie.useMemo(() => {
      var xe;
      return (xe = v.closeButton) != null ? xe : V;
    }, [v.closeButton, V]),
    $r = ie.useMemo(() => v.duration || te || gy, [v.duration, te]),
    zi = ie.useRef(0),
    Hn = ie.useRef(0),
    $l = ie.useRef(0),
    cr = ie.useRef(null),
    [Jr, _t] = oe.split("-"),
    fn = ie.useMemo(
      () => R.reduce((xe, Xe, ft) => (ft >= Fr ? xe : xe + Xe.height), 0),
      [R, Fr],
    ),
    bt = LO(),
    uu = v.invert || g,
    Ui = Ct === "loading";
  ((Hn.current = ie.useMemo(() => Fr * se + fn, [Fr, fn])),
    ie.useEffect(() => {
      cn.current = $r;
    }, [$r]),
    ie.useEffect(() => {
      I(!0);
    }, []),
    ie.useEffect(() => {
      const xe = kt.current;
      if (xe) {
        const Xe = xe.getBoundingClientRect().height;
        return (
          Sn(Xe),
          C((ft) => [
            { toastId: v.id, height: Xe, position: v.position },
            ...ft,
          ]),
          () => C((ft) => ft.filter((xt) => xt.toastId !== v.id))
        );
      }
    }, [C, v.id]),
    ie.useLayoutEffect(() => {
      if (!k) return;
      const xe = kt.current,
        Xe = xe.style.height;
      xe.style.height = "auto";
      const ft = xe.getBoundingClientRect().height;
      ((xe.style.height = Xe),
        Sn(ft),
        C((xt) =>
          xt.find((Ze) => Ze.toastId === v.id)
            ? xt.map((Ze) => (Ze.toastId === v.id ? { ...Ze, height: ft } : Ze))
            : [{ toastId: v.id, height: ft, position: v.position }, ...xt],
        ));
    }, [k, v.title, v.description, C, v.id, v.jsx, v.action, v.cancel]));
  const wn = ie.useCallback(() => {
    (ue(!0),
      Ke(Hn.current),
      C((xe) => xe.filter((Xe) => Xe.toastId !== v.id)),
      setTimeout(() => {
        Z(v);
      }, ZO));
  }, [v, Z, C, Hn]);
  (ie.useEffect(() => {
    if (
      (v.promise && Ct === "loading") ||
      v.duration === 1 / 0 ||
      v.type === "loading"
    )
      return;
    let xe;
    return (
      q || E || bt
        ? (() => {
            if ($l.current < zi.current) {
              const xt = new Date().getTime() - zi.current;
              cn.current = cn.current - xt;
            }
            $l.current = new Date().getTime();
          })()
        : cn.current !== 1 / 0 &&
          ((zi.current = new Date().getTime()),
          (xe = setTimeout(() => {
            (v.onAutoClose == null || v.onAutoClose.call(v, v), wn());
          }, cn.current))),
      () => clearTimeout(xe)
    );
  }, [q, E, v, Ct, bt, wn]),
    ie.useEffect(() => {
      v.delete && (wn(), v.onDismiss == null || v.onDismiss.call(v, v));
    }, [wn, v.delete]));
  function Na() {
    var xe;
    if (B?.loading) {
      var Xe;
      return ie.createElement(
        "div",
        {
          className: Rn(
            A?.loader,
            v == null || (Xe = v.classNames) == null ? void 0 : Xe.loader,
            "sonner-loader",
          ),
          "data-visible": Ct === "loading",
        },
        B.loading,
      );
    }
    return ie.createElement(MO, {
      className: Rn(
        A?.loader,
        v == null || (xe = v.classNames) == null ? void 0 : xe.loader,
      ),
      visible: Ct === "loading",
    });
  }
  const Da = v.icon || B?.[Ct] || AO(Ct);
  var Wr, En;
  return ie.createElement(
    "li",
    {
      tabIndex: 0,
      ref: kt,
      className: Rn(
        ne,
        Tt,
        A?.toast,
        v == null || (a = v.classNames) == null ? void 0 : a.toast,
        A?.default,
        A?.[Ct],
        v == null || (i = v.classNames) == null ? void 0 : i[Ct],
      ),
      "data-sonner-toast": "",
      "data-rich-colors": (Wr = v.richColors) != null ? Wr : Q,
      "data-styled": !(v.jsx || v.unstyled || w),
      "data-mounted": k,
      "data-promise": !!v.promise,
      "data-swiped": Ce,
      "data-removed": ee,
      "data-visible": ji,
      "data-y-position": Jr,
      "data-x-position": _t,
      "data-index": M,
      "data-front": Di,
      "data-swiping": re,
      "data-dismissible": ur,
      "data-type": Ct,
      "data-invert": uu,
      "data-swipe-out": pe,
      "data-swipe-direction": T,
      "data-expanded": !!(q || (ce && k)),
      "data-testid": v.testId,
      style: {
        "--index": M,
        "--toasts-before": M,
        "--z-index": j.length - M,
        "--offset": `${ee ? et : Hn.current}px`,
        "--initial-height": ce ? "auto" : `${Ln}px`,
        ...N,
        ...v.style,
      },
      onDragEnd: () => {
        (de(!1), J(null), (cr.current = null));
      },
      onPointerDown: (xe) => {
        xe.button !== 2 &&
          (Ui ||
            !ur ||
            ((Ni.current = new Date()),
            Ke(Hn.current),
            xe.target.setPointerCapture(xe.pointerId),
            xe.target.tagName !== "BUTTON" &&
              (de(!0), (cr.current = { x: xe.clientX, y: xe.clientY }))));
      },
      onPointerUp: () => {
        var xe, Xe, ft;
        if (pe || !ur) return;
        cr.current = null;
        const xt = Number(
            ((xe = kt.current) == null
              ? void 0
              : xe.style
                  .getPropertyValue("--swipe-amount-x")
                  .replace("px", "")) || 0,
          ),
          fr = Number(
            ((Xe = kt.current) == null
              ? void 0
              : Xe.style
                  .getPropertyValue("--swipe-amount-y")
                  .replace("px", "")) || 0,
          ),
          Ze =
            new Date().getTime() -
            ((ft = Ni.current) == null ? void 0 : ft.getTime()),
          Mt = le === "x" ? xt : fr,
          ea = Math.abs(Mt) / Ze;
        if (Math.abs(Mt) >= IO || ea > 0.11) {
          (Ke(Hn.current),
            v.onDismiss == null || v.onDismiss.call(v, v),
            G(
              le === "x" ? (xt > 0 ? "right" : "left") : fr > 0 ? "down" : "up",
            ),
            wn(),
            Oe(!0));
          return;
        } else {
          var Nt, Dt;
          ((Nt = kt.current) == null ||
            Nt.style.setProperty("--swipe-amount-x", "0px"),
            (Dt = kt.current) == null ||
              Dt.style.setProperty("--swipe-amount-y", "0px"));
        }
        (Re(!1), de(!1), J(null));
      },
      onPointerMove: (xe) => {
        var Xe, ft, xt;
        if (
          !cr.current ||
          !ur ||
          ((Xe = window.getSelection()) == null
            ? void 0
            : Xe.toString().length) > 0
        )
          return;
        const Ze = xe.clientY - cr.current.y,
          Mt = xe.clientX - cr.current.x;
        var ea;
        const Nt = (ea = n.swipeDirections) != null ? ea : FO(oe);
        !le &&
          (Math.abs(Mt) > 1 || Math.abs(Ze) > 1) &&
          J(Math.abs(Mt) > Math.abs(Ze) ? "x" : "y");
        let Dt = { x: 0, y: 0 };
        const ja = (dn) => 1 / (1.5 + Math.abs(dn) / 20);
        if (le === "y") {
          if (Nt.includes("top") || Nt.includes("bottom"))
            if (
              (Nt.includes("top") && Ze < 0) ||
              (Nt.includes("bottom") && Ze > 0)
            )
              Dt.y = Ze;
            else {
              const dn = Ze * ja(Ze);
              Dt.y = Math.abs(dn) < Math.abs(Ze) ? dn : Ze;
            }
        } else if (le === "x" && (Nt.includes("left") || Nt.includes("right")))
          if (
            (Nt.includes("left") && Mt < 0) ||
            (Nt.includes("right") && Mt > 0)
          )
            Dt.x = Mt;
          else {
            const dn = Mt * ja(Mt);
            Dt.x = Math.abs(dn) < Math.abs(Mt) ? dn : Mt;
          }
        ((Math.abs(Dt.x) > 0 || Math.abs(Dt.y) > 0) && Re(!0),
          (ft = kt.current) == null ||
            ft.style.setProperty("--swipe-amount-x", `${Dt.x}px`),
          (xt = kt.current) == null ||
            xt.style.setProperty("--swipe-amount-y", `${Dt.y}px`));
      },
    },
    Fl && !v.jsx && Ct !== "loading"
      ? ie.createElement(
          "button",
          {
            "aria-label": K,
            "data-disabled": Ui,
            "data-close-button": !0,
            onClick:
              Ui || !ur
                ? () => {}
                : () => {
                    (wn(), v.onDismiss == null || v.onDismiss.call(v, v));
                  },
            className: Rn(
              A?.closeButton,
              v == null || (o = v.classNames) == null ? void 0 : o.closeButton,
            ),
          },
          (En = B?.close) != null ? En : UO,
        )
      : null,
    (Ct || v.icon || v.promise) &&
      v.icon !== null &&
      (B?.[Ct] !== null || v.icon)
      ? ie.createElement(
          "div",
          {
            "data-icon": "",
            className: Rn(
              A?.icon,
              v == null || (s = v.classNames) == null ? void 0 : s.icon,
            ),
          },
          v.promise || (v.type === "loading" && !v.icon)
            ? v.icon || Na()
            : null,
          v.type !== "loading" ? Da : null,
        )
      : null,
    ie.createElement(
      "div",
      {
        "data-content": "",
        className: Rn(
          A?.content,
          v == null || (c = v.classNames) == null ? void 0 : c.content,
        ),
      },
      ie.createElement(
        "div",
        {
          "data-title": "",
          className: Rn(
            A?.title,
            v == null || (d = v.classNames) == null ? void 0 : d.title,
          ),
        },
        v.jsx ? v.jsx : typeof v.title == "function" ? v.title() : v.title,
      ),
      v.description
        ? ie.createElement(
            "div",
            {
              "data-description": "",
              className: Rn(
                ae,
                su,
                A?.description,
                v == null || (h = v.classNames) == null
                  ? void 0
                  : h.description,
              ),
            },
            typeof v.description == "function"
              ? v.description()
              : v.description,
          )
        : null,
    ),
    ie.isValidElement(v.cancel)
      ? v.cancel
      : v.cancel && ps(v.cancel)
        ? ie.createElement(
            "button",
            {
              "data-button": !0,
              "data-cancel": !0,
              style: v.cancelButtonStyle || U,
              onClick: (xe) => {
                ps(v.cancel) &&
                  ur &&
                  (v.cancel.onClick == null ||
                    v.cancel.onClick.call(v.cancel, xe),
                  wn());
              },
              className: Rn(
                A?.cancelButton,
                v == null || (m = v.classNames) == null
                  ? void 0
                  : m.cancelButton,
              ),
            },
            v.cancel.label,
          )
        : null,
    ie.isValidElement(v.action)
      ? v.action
      : v.action && ps(v.action)
        ? ie.createElement(
            "button",
            {
              "data-button": !0,
              "data-action": !0,
              style: v.actionButtonStyle || W,
              onClick: (xe) => {
                ps(v.action) &&
                  (v.action.onClick == null ||
                    v.action.onClick.call(v.action, xe),
                  !xe.defaultPrevented && wn());
              },
              className: Rn(
                A?.actionButton,
                v == null || (p = v.classNames) == null
                  ? void 0
                  : p.actionButton,
              ),
            },
            v.action.label,
          )
        : null,
  );
};
function by() {
  if (typeof window > "u" || typeof document > "u") return "ltr";
  const n = document.documentElement.getAttribute("dir");
  return n === "auto" || !n
    ? window.getComputedStyle(document.documentElement).direction
    : n;
}
function JO(n, a) {
  const i = {};
  return (
    [n, a].forEach((o, s) => {
      const c = s === 1,
        d = c ? "--mobile-offset" : "--offset",
        h = c ? GO : YO;
      function m(p) {
        ["top", "right", "bottom", "left"].forEach((g) => {
          i[`${d}-${g}`] = typeof p == "number" ? `${p}px` : p;
        });
      }
      typeof o == "number" || typeof o == "string"
        ? m(o)
        : typeof o == "object"
          ? ["top", "right", "bottom", "left"].forEach((p) => {
              o[p] === void 0
                ? (i[`${d}-${p}`] = h)
                : (i[`${d}-${p}`] =
                    typeof o[p] == "number" ? `${o[p]}px` : o[p]);
            })
          : m(h);
    }),
    i
  );
}
const WO = ie.forwardRef(function (a, i) {
    const {
        id: o,
        invert: s,
        position: c = "bottom-right",
        hotkey: d = ["altKey", "KeyT"],
        expand: h,
        closeButton: m,
        className: p,
        offset: g,
        mobileOffset: v,
        theme: w = "light",
        richColors: E,
        duration: C,
        style: S,
        visibleToasts: R = VO,
        toastOptions: M,
        dir: j = by(),
        gap: q = XO,
        icons: Z,
        containerAriaLabel: Q = "Notifications",
      } = a,
      [V, N] = ie.useState([]),
      U = ie.useMemo(
        () =>
          o
            ? V.filter((k) => k.toasterId === o)
            : V.filter((k) => !k.toasterId),
        [V, o],
      ),
      W = ie.useMemo(
        () =>
          Array.from(
            new Set(
              [c].concat(U.filter((k) => k.position).map((k) => k.position)),
            ),
          ),
        [U, c],
      ),
      [ne, ae] = ie.useState([]),
      [te, oe] = ie.useState(!1),
      [se, ce] = ie.useState(!1),
      [A, B] = ie.useState(
        w !== "system"
          ? w
          : typeof window < "u" &&
              window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
      ),
      K = ie.useRef(null),
      le = d.join("+").replace(/Key/g, "").replace(/Digit/g, ""),
      J = ie.useRef(null),
      T = ie.useRef(!1),
      G = ie.useCallback((k) => {
        N((I) => {
          var ee;
          return (
            ((ee = I.find((ue) => ue.id === k.id)) != null && ee.delete) ||
              Pt.dismiss(k.id),
            I.filter(({ id: ue }) => ue !== k.id)
          );
        });
      }, []);
    return (
      ie.useEffect(
        () =>
          Pt.subscribe((k) => {
            if (k.dismiss) {
              requestAnimationFrame(() => {
                N((I) =>
                  I.map((ee) => (ee.id === k.id ? { ...ee, delete: !0 } : ee)),
                );
              });
              return;
            }
            setTimeout(() => {
              h0.flushSync(() => {
                N((I) => {
                  const ee = I.findIndex((ue) => ue.id === k.id);
                  return ee !== -1
                    ? [
                        ...I.slice(0, ee),
                        { ...I[ee], ...k },
                        ...I.slice(ee + 1),
                      ]
                    : [k, ...I];
                });
              });
            });
          }),
        [V],
      ),
      ie.useEffect(() => {
        if (w !== "system") {
          B(w);
          return;
        }
        if (
          (w === "system" &&
            (window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? B("dark")
              : B("light")),
          typeof window > "u")
        )
          return;
        const k = window.matchMedia("(prefers-color-scheme: dark)");
        try {
          k.addEventListener("change", ({ matches: I }) => {
            B(I ? "dark" : "light");
          });
        } catch {
          k.addListener(({ matches: ee }) => {
            try {
              B(ee ? "dark" : "light");
            } catch (ue) {
              console.error(ue);
            }
          });
        }
      }, [w]),
      ie.useEffect(() => {
        V.length <= 1 && oe(!1);
      }, [V]),
      ie.useEffect(() => {
        const k = (I) => {
          var ee;
          if (d.every((de) => I[de] || I.code === de)) {
            var re;
            (oe(!0), (re = K.current) == null || re.focus());
          }
          I.code === "Escape" &&
            (document.activeElement === K.current ||
              ((ee = K.current) != null &&
                ee.contains(document.activeElement))) &&
            oe(!1);
        };
        return (
          document.addEventListener("keydown", k),
          () => document.removeEventListener("keydown", k)
        );
      }, [d]),
      ie.useEffect(() => {
        if (K.current)
          return () => {
            J.current &&
              (J.current.focus({ preventScroll: !0 }),
              (J.current = null),
              (T.current = !1));
          };
      }, [K.current]),
      ie.createElement(
        "section",
        {
          ref: i,
          "aria-label": `${Q} ${le}`,
          tabIndex: -1,
          "aria-live": "polite",
          "aria-relevant": "additions text",
          "aria-atomic": "false",
          suppressHydrationWarning: !0,
        },
        W.map((k, I) => {
          var ee;
          const [ue, re] = k.split("-");
          return U.length
            ? ie.createElement(
                "ol",
                {
                  key: k,
                  dir: j === "auto" ? by() : j,
                  tabIndex: -1,
                  ref: K,
                  className: p,
                  "data-sonner-toaster": !0,
                  "data-sonner-theme": A,
                  "data-y-position": ue,
                  "data-x-position": re,
                  style: {
                    "--front-toast-height": `${((ee = ne[0]) == null ? void 0 : ee.height) || 0}px`,
                    "--width": `${KO}px`,
                    "--gap": `${q}px`,
                    ...S,
                    ...JO(g, v),
                  },
                  onBlur: (de) => {
                    T.current &&
                      !de.currentTarget.contains(de.relatedTarget) &&
                      ((T.current = !1),
                      J.current &&
                        (J.current.focus({ preventScroll: !0 }),
                        (J.current = null)));
                  },
                  onFocus: (de) => {
                    (de.target instanceof HTMLElement &&
                      de.target.dataset.dismissible === "false") ||
                      T.current ||
                      ((T.current = !0), (J.current = de.relatedTarget));
                  },
                  onMouseEnter: () => oe(!0),
                  onMouseMove: () => oe(!0),
                  onMouseLeave: () => {
                    se || oe(!1);
                  },
                  onDragEnd: () => oe(!1),
                  onPointerDown: (de) => {
                    (de.target instanceof HTMLElement &&
                      de.target.dataset.dismissible === "false") ||
                      ce(!0);
                  },
                  onPointerUp: () => ce(!1),
                },
                U.filter(
                  (de) => (!de.position && I === 0) || de.position === k,
                ).map((de, pe) => {
                  var Oe, Ce;
                  return ie.createElement($O, {
                    key: de.id,
                    icons: Z,
                    index: pe,
                    toast: de,
                    defaultRichColors: E,
                    duration: (Oe = M?.duration) != null ? Oe : C,
                    className: M?.className,
                    descriptionClassName: M?.descriptionClassName,
                    invert: s,
                    visibleToasts: R,
                    closeButton: (Ce = M?.closeButton) != null ? Ce : m,
                    interacting: se,
                    position: k,
                    style: M?.style,
                    unstyled: M?.unstyled,
                    classNames: M?.classNames,
                    cancelButtonStyle: M?.cancelButtonStyle,
                    actionButtonStyle: M?.actionButtonStyle,
                    closeButtonAriaLabel: M?.closeButtonAriaLabel,
                    removeToast: G,
                    toasts: U.filter((Re) => Re.position == de.position),
                    heights: ne.filter((Re) => Re.position == de.position),
                    setHeights: ae,
                    expandByDefault: h,
                    gap: q,
                    expanded: te,
                    swipeDirections: a.swipeDirections,
                  });
                }),
              )
            : null;
        }),
      )
    );
  }),
  e2 = ({ ...n }) => {
    const { theme: a = "system" } = TO();
    return O.jsx(WO, {
      theme: a,
      className: "toaster group",
      style: {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      },
      ...n,
    });
  };
function Ve(n, a, { checkForDefaultPrevented: i = !0 } = {}) {
  return function (s) {
    if ((n?.(s), i === !1 || !s.defaultPrevented)) return a?.(s);
  };
}
function xy(n, a) {
  if (typeof n == "function") return n(a);
  n != null && (n.current = a);
}
function Xl(...n) {
  return (a) => {
    let i = !1;
    const o = n.map((s) => {
      const c = xy(s, a);
      return (!i && typeof c == "function" && (i = !0), c);
    });
    if (i)
      return () => {
        for (let s = 0; s < o.length; s++) {
          const c = o[s];
          typeof c == "function" ? c() : xy(n[s], null);
        }
      };
  };
}
function st(...n) {
  return b.useCallback(Xl(...n), n);
}
function Zs(n, a = []) {
  let i = [];
  function o(c, d) {
    const h = b.createContext(d),
      m = i.length;
    i = [...i, d];
    const p = (v) => {
      const { scope: w, children: E, ...C } = v,
        S = w?.[n]?.[m] || h,
        R = b.useMemo(() => C, Object.values(C));
      return O.jsx(S.Provider, { value: R, children: E });
    };
    p.displayName = c + "Provider";
    function g(v, w) {
      const E = w?.[n]?.[m] || h,
        C = b.useContext(E);
      if (C) return C;
      if (d !== void 0) return d;
      throw new Error(`\`${v}\` must be used within \`${c}\``);
    }
    return [p, g];
  }
  const s = () => {
    const c = i.map((d) => b.createContext(d));
    return function (h) {
      const m = h?.[n] || c;
      return b.useMemo(() => ({ [`__scope${n}`]: { ...h, [n]: m } }), [h, m]);
    };
  };
  return ((s.scopeName = n), [o, t2(s, ...a)]);
}
function t2(...n) {
  const a = n[0];
  if (n.length === 1) return a;
  const i = () => {
    const o = n.map((s) => ({ useScope: s(), scopeName: s.scopeName }));
    return function (c) {
      const d = o.reduce((h, { useScope: m, scopeName: p }) => {
        const v = m(c)[`__scope${p}`];
        return { ...h, ...v };
      }, {});
      return b.useMemo(() => ({ [`__scope${a.scopeName}`]: d }), [d]);
    };
  };
  return ((i.scopeName = a.scopeName), i);
}
function n2(n) {
  const a = r2(n),
    i = b.forwardRef((o, s) => {
      const { children: c, ...d } = o,
        h = b.Children.toArray(c),
        m = h.find(i2);
      if (m) {
        const p = m.props.children,
          g = h.map((v) =>
            v === m
              ? b.Children.count(p) > 1
                ? b.Children.only(null)
                : b.isValidElement(p)
                  ? p.props.children
                  : null
              : v,
          );
        return O.jsx(a, {
          ...d,
          ref: s,
          children: b.isValidElement(p) ? b.cloneElement(p, void 0, g) : null,
        });
      }
      return O.jsx(a, { ...d, ref: s, children: c });
    });
  return ((i.displayName = `${n}.Slot`), i);
}
function r2(n) {
  const a = b.forwardRef((i, o) => {
    const { children: s, ...c } = i;
    if (b.isValidElement(s)) {
      const d = o2(s),
        h = l2(c, s.props);
      return (
        s.type !== b.Fragment && (h.ref = o ? Xl(o, d) : d),
        b.cloneElement(s, h)
      );
    }
    return b.Children.count(s) > 1 ? b.Children.only(null) : null;
  });
  return ((a.displayName = `${n}.SlotClone`), a);
}
var a2 = Symbol("radix.slottable");
function i2(n) {
  return (
    b.isValidElement(n) &&
    typeof n.type == "function" &&
    "__radixId" in n.type &&
    n.type.__radixId === a2
  );
}
function l2(n, a) {
  const i = { ...a };
  for (const o in a) {
    const s = n[o],
      c = a[o];
    /^on[A-Z]/.test(o)
      ? s && c
        ? (i[o] = (...h) => {
            const m = c(...h);
            return (s(...h), m);
          })
        : s && (i[o] = s)
      : o === "style"
        ? (i[o] = { ...s, ...c })
        : o === "className" && (i[o] = [s, c].filter(Boolean).join(" "));
  }
  return { ...n, ...i };
}
function o2(n) {
  let a = Object.getOwnPropertyDescriptor(n.props, "ref")?.get,
    i = a && "isReactWarning" in a && a.isReactWarning;
  return i
    ? n.ref
    : ((a = Object.getOwnPropertyDescriptor(n, "ref")?.get),
      (i = a && "isReactWarning" in a && a.isReactWarning),
      i ? n.props.ref : n.props.ref || n.ref);
}
var s2 = [
    "a",
    "button",
    "div",
    "form",
    "h2",
    "h3",
    "img",
    "input",
    "label",
    "li",
    "nav",
    "ol",
    "p",
    "select",
    "span",
    "svg",
    "ul",
  ],
  We = s2.reduce((n, a) => {
    const i = n2(`Primitive.${a}`),
      o = b.forwardRef((s, c) => {
        const { asChild: d, ...h } = s,
          m = d ? i : a;
        return (
          typeof window < "u" && (window[Symbol.for("radix-ui")] = !0),
          O.jsx(m, { ...h, ref: c })
        );
      });
    return ((o.displayName = `Primitive.${a}`), { ...n, [a]: o });
  }, {});
function u2(n, a) {
  n && Kl.flushSync(() => n.dispatchEvent(a));
}
function Ea(n) {
  const a = b.useRef(n);
  return (
    b.useEffect(() => {
      a.current = n;
    }),
    b.useMemo(
      () =>
        (...i) =>
          a.current?.(...i),
      [],
    )
  );
}
function c2(n, a = globalThis?.document) {
  const i = Ea(n);
  b.useEffect(() => {
    const o = (s) => {
      s.key === "Escape" && i(s);
    };
    return (
      a.addEventListener("keydown", o, { capture: !0 }),
      () => a.removeEventListener("keydown", o, { capture: !0 })
    );
  }, [i, a]);
}
var f2 = "DismissableLayer",
  cd = "dismissableLayer.update",
  d2 = "dismissableLayer.pointerDownOutside",
  h2 = "dismissableLayer.focusOutside",
  Sy,
  m0 = b.createContext({
    layers: new Set(),
    layersWithOutsidePointerEventsDisabled: new Set(),
    branches: new Set(),
  }),
  Dd = b.forwardRef((n, a) => {
    const {
        disableOutsidePointerEvents: i = !1,
        onEscapeKeyDown: o,
        onPointerDownOutside: s,
        onFocusOutside: c,
        onInteractOutside: d,
        onDismiss: h,
        ...m
      } = n,
      p = b.useContext(m0),
      [g, v] = b.useState(null),
      w = g?.ownerDocument ?? globalThis?.document,
      [, E] = b.useState({}),
      C = st(a, (N) => v(N)),
      S = Array.from(p.layers),
      [R] = [...p.layersWithOutsidePointerEventsDisabled].slice(-1),
      M = S.indexOf(R),
      j = g ? S.indexOf(g) : -1,
      q = p.layersWithOutsidePointerEventsDisabled.size > 0,
      Z = j >= M,
      Q = v2((N) => {
        const U = N.target,
          W = [...p.branches].some((ne) => ne.contains(U));
        !Z || W || (s?.(N), d?.(N), N.defaultPrevented || h?.());
      }, w),
      V = y2((N) => {
        const U = N.target;
        [...p.branches].some((ne) => ne.contains(U)) ||
          (c?.(N), d?.(N), N.defaultPrevented || h?.());
      }, w);
    return (
      c2((N) => {
        j === p.layers.size - 1 &&
          (o?.(N), !N.defaultPrevented && h && (N.preventDefault(), h()));
      }, w),
      b.useEffect(() => {
        if (g)
          return (
            i &&
              (p.layersWithOutsidePointerEventsDisabled.size === 0 &&
                ((Sy = w.body.style.pointerEvents),
                (w.body.style.pointerEvents = "none")),
              p.layersWithOutsidePointerEventsDisabled.add(g)),
            p.layers.add(g),
            wy(),
            () => {
              i &&
                p.layersWithOutsidePointerEventsDisabled.size === 1 &&
                (w.body.style.pointerEvents = Sy);
            }
          );
      }, [g, w, i, p]),
      b.useEffect(
        () => () => {
          g &&
            (p.layers.delete(g),
            p.layersWithOutsidePointerEventsDisabled.delete(g),
            wy());
        },
        [g, p],
      ),
      b.useEffect(() => {
        const N = () => E({});
        return (
          document.addEventListener(cd, N),
          () => document.removeEventListener(cd, N)
        );
      }, []),
      O.jsx(We.div, {
        ...m,
        ref: C,
        style: {
          pointerEvents: q ? (Z ? "auto" : "none") : void 0,
          ...n.style,
        },
        onFocusCapture: Ve(n.onFocusCapture, V.onFocusCapture),
        onBlurCapture: Ve(n.onBlurCapture, V.onBlurCapture),
        onPointerDownCapture: Ve(
          n.onPointerDownCapture,
          Q.onPointerDownCapture,
        ),
      })
    );
  });
Dd.displayName = f2;
var m2 = "DismissableLayerBranch",
  p2 = b.forwardRef((n, a) => {
    const i = b.useContext(m0),
      o = b.useRef(null),
      s = st(a, o);
    return (
      b.useEffect(() => {
        const c = o.current;
        if (c)
          return (
            i.branches.add(c),
            () => {
              i.branches.delete(c);
            }
          );
      }, [i.branches]),
      O.jsx(We.div, { ...n, ref: s })
    );
  });
p2.displayName = m2;
function v2(n, a = globalThis?.document) {
  const i = Ea(n),
    o = b.useRef(!1),
    s = b.useRef(() => {});
  return (
    b.useEffect(() => {
      const c = (h) => {
          if (h.target && !o.current) {
            let m = function () {
              p0(d2, i, p, { discrete: !0 });
            };
            const p = { originalEvent: h };
            h.pointerType === "touch"
              ? (a.removeEventListener("click", s.current),
                (s.current = m),
                a.addEventListener("click", s.current, { once: !0 }))
              : m();
          } else a.removeEventListener("click", s.current);
          o.current = !1;
        },
        d = window.setTimeout(() => {
          a.addEventListener("pointerdown", c);
        }, 0);
      return () => {
        (window.clearTimeout(d),
          a.removeEventListener("pointerdown", c),
          a.removeEventListener("click", s.current));
      };
    }, [a, i]),
    { onPointerDownCapture: () => (o.current = !0) }
  );
}
function y2(n, a = globalThis?.document) {
  const i = Ea(n),
    o = b.useRef(!1);
  return (
    b.useEffect(() => {
      const s = (c) => {
        c.target &&
          !o.current &&
          p0(h2, i, { originalEvent: c }, { discrete: !1 });
      };
      return (
        a.addEventListener("focusin", s),
        () => a.removeEventListener("focusin", s)
      );
    }, [a, i]),
    {
      onFocusCapture: () => (o.current = !0),
      onBlurCapture: () => (o.current = !1),
    }
  );
}
function wy() {
  const n = new CustomEvent(cd);
  document.dispatchEvent(n);
}
function p0(n, a, i, { discrete: o }) {
  const s = i.originalEvent.target,
    c = new CustomEvent(n, { bubbles: !1, cancelable: !0, detail: i });
  (a && s.addEventListener(n, a, { once: !0 }),
    o ? u2(s, c) : s.dispatchEvent(c));
}
var Et = globalThis?.document ? b.useLayoutEffect : () => {},
  g2 = Ql[" useId ".trim().toString()] || (() => {}),
  b2 = 0;
function jd(n) {
  const [a, i] = b.useState(g2());
  return (
    Et(() => {
      i((o) => o ?? String(b2++));
    }, [n]),
    n || (a ? `radix-${a}` : "")
  );
}
const x2 = ["top", "right", "bottom", "left"],
  Yr = Math.min,
  Zt = Math.max,
  js = Math.round,
  vs = Math.floor,
  jn = (n) => ({ x: n, y: n }),
  S2 = { left: "right", right: "left", bottom: "top", top: "bottom" };
function fd(n, a, i) {
  return Zt(n, Yr(a, i));
}
function ir(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function lr(n) {
  return n.split("-")[0];
}
function Ai(n) {
  return n.split("-")[1];
}
function zd(n) {
  return n === "x" ? "y" : "x";
}
function Ud(n) {
  return n === "y" ? "height" : "width";
}
function Dn(n) {
  const a = n[0];
  return a === "t" || a === "b" ? "y" : "x";
}
function Ld(n) {
  return zd(Dn(n));
}
function w2(n, a, i) {
  i === void 0 && (i = !1);
  const o = Ai(n),
    s = Ld(n),
    c = Ud(s);
  let d =
    s === "x"
      ? o === (i ? "end" : "start")
        ? "right"
        : "left"
      : o === "start"
        ? "bottom"
        : "top";
  return (a.reference[c] > a.floating[c] && (d = zs(d)), [d, zs(d)]);
}
function E2(n) {
  const a = zs(n);
  return [dd(n), a, dd(a)];
}
function dd(n) {
  return n.includes("start")
    ? n.replace("start", "end")
    : n.replace("end", "start");
}
const Ey = ["left", "right"],
  Oy = ["right", "left"],
  O2 = ["top", "bottom"],
  C2 = ["bottom", "top"];
function T2(n, a, i) {
  switch (n) {
    case "top":
    case "bottom":
      return i ? (a ? Oy : Ey) : a ? Ey : Oy;
    case "left":
    case "right":
      return a ? O2 : C2;
    default:
      return [];
  }
}
function _2(n, a, i, o) {
  const s = Ai(n);
  let c = T2(lr(n), i === "start", o);
  return (
    s && ((c = c.map((d) => d + "-" + s)), a && (c = c.concat(c.map(dd)))),
    c
  );
}
function zs(n) {
  const a = lr(n);
  return S2[a] + n.slice(a.length);
}
function A2(n) {
  return { top: 0, right: 0, bottom: 0, left: 0, ...n };
}
function v0(n) {
  return typeof n != "number"
    ? A2(n)
    : { top: n, right: n, bottom: n, left: n };
}
function Us(n) {
  const { x: a, y: i, width: o, height: s } = n;
  return {
    width: o,
    height: s,
    top: i,
    left: a,
    right: a + o,
    bottom: i + s,
    x: a,
    y: i,
  };
}
function Cy(n, a, i) {
  let { reference: o, floating: s } = n;
  const c = Dn(a),
    d = Ld(a),
    h = Ud(d),
    m = lr(a),
    p = c === "y",
    g = o.x + o.width / 2 - s.width / 2,
    v = o.y + o.height / 2 - s.height / 2,
    w = o[h] / 2 - s[h] / 2;
  let E;
  switch (m) {
    case "top":
      E = { x: g, y: o.y - s.height };
      break;
    case "bottom":
      E = { x: g, y: o.y + o.height };
      break;
    case "right":
      E = { x: o.x + o.width, y: v };
      break;
    case "left":
      E = { x: o.x - s.width, y: v };
      break;
    default:
      E = { x: o.x, y: o.y };
  }
  switch (Ai(a)) {
    case "start":
      E[d] -= w * (i && p ? -1 : 1);
      break;
    case "end":
      E[d] += w * (i && p ? -1 : 1);
      break;
  }
  return E;
}
async function R2(n, a) {
  var i;
  a === void 0 && (a = {});
  const { x: o, y: s, platform: c, rects: d, elements: h, strategy: m } = n,
    {
      boundary: p = "clippingAncestors",
      rootBoundary: g = "viewport",
      elementContext: v = "floating",
      altBoundary: w = !1,
      padding: E = 0,
    } = ir(a, n),
    C = v0(E),
    R = h[w ? (v === "floating" ? "reference" : "floating") : v],
    M = Us(
      await c.getClippingRect({
        element:
          (i = await (c.isElement == null ? void 0 : c.isElement(R))) == null ||
          i
            ? R
            : R.contextElement ||
              (await (c.getDocumentElement == null
                ? void 0
                : c.getDocumentElement(h.floating))),
        boundary: p,
        rootBoundary: g,
        strategy: m,
      }),
    ),
    j =
      v === "floating"
        ? { x: o, y: s, width: d.floating.width, height: d.floating.height }
        : d.reference,
    q = await (c.getOffsetParent == null
      ? void 0
      : c.getOffsetParent(h.floating)),
    Z = (await (c.isElement == null ? void 0 : c.isElement(q)))
      ? (await (c.getScale == null ? void 0 : c.getScale(q))) || { x: 1, y: 1 }
      : { x: 1, y: 1 },
    Q = Us(
      c.convertOffsetParentRelativeRectToViewportRelativeRect
        ? await c.convertOffsetParentRelativeRectToViewportRelativeRect({
            elements: h,
            rect: j,
            offsetParent: q,
            strategy: m,
          })
        : j,
    );
  return {
    top: (M.top - Q.top + C.top) / Z.y,
    bottom: (Q.bottom - M.bottom + C.bottom) / Z.y,
    left: (M.left - Q.left + C.left) / Z.x,
    right: (Q.right - M.right + C.right) / Z.x,
  };
}
const M2 = 50,
  N2 = async (n, a, i) => {
    const {
        placement: o = "bottom",
        strategy: s = "absolute",
        middleware: c = [],
        platform: d,
      } = i,
      h = d.detectOverflow ? d : { ...d, detectOverflow: R2 },
      m = await (d.isRTL == null ? void 0 : d.isRTL(a));
    let p = await d.getElementRects({ reference: n, floating: a, strategy: s }),
      { x: g, y: v } = Cy(p, o, m),
      w = o,
      E = 0;
    const C = {};
    for (let S = 0; S < c.length; S++) {
      const R = c[S];
      if (!R) continue;
      const { name: M, fn: j } = R,
        {
          x: q,
          y: Z,
          data: Q,
          reset: V,
        } = await j({
          x: g,
          y: v,
          initialPlacement: o,
          placement: w,
          strategy: s,
          middlewareData: C,
          rects: p,
          platform: h,
          elements: { reference: n, floating: a },
        });
      ((g = q ?? g),
        (v = Z ?? v),
        (C[M] = { ...C[M], ...Q }),
        V &&
          E < M2 &&
          (E++,
          typeof V == "object" &&
            (V.placement && (w = V.placement),
            V.rects &&
              (p =
                V.rects === !0
                  ? await d.getElementRects({
                      reference: n,
                      floating: a,
                      strategy: s,
                    })
                  : V.rects),
            ({ x: g, y: v } = Cy(p, w, m))),
          (S = -1)));
    }
    return { x: g, y: v, placement: w, strategy: s, middlewareData: C };
  },
  D2 = (n) => ({
    name: "arrow",
    options: n,
    async fn(a) {
      const {
          x: i,
          y: o,
          placement: s,
          rects: c,
          platform: d,
          elements: h,
          middlewareData: m,
        } = a,
        { element: p, padding: g = 0 } = ir(n, a) || {};
      if (p == null) return {};
      const v = v0(g),
        w = { x: i, y: o },
        E = Ld(s),
        C = Ud(E),
        S = await d.getDimensions(p),
        R = E === "y",
        M = R ? "top" : "left",
        j = R ? "bottom" : "right",
        q = R ? "clientHeight" : "clientWidth",
        Z = c.reference[C] + c.reference[E] - w[E] - c.floating[C],
        Q = w[E] - c.reference[E],
        V = await (d.getOffsetParent == null ? void 0 : d.getOffsetParent(p));
      let N = V ? V[q] : 0;
      (!N || !(await (d.isElement == null ? void 0 : d.isElement(V)))) &&
        (N = h.floating[q] || c.floating[C]);
      const U = Z / 2 - Q / 2,
        W = N / 2 - S[C] / 2 - 1,
        ne = Yr(v[M], W),
        ae = Yr(v[j], W),
        te = ne,
        oe = N - S[C] - ae,
        se = N / 2 - S[C] / 2 + U,
        ce = fd(te, se, oe),
        A =
          !m.arrow &&
          Ai(s) != null &&
          se !== ce &&
          c.reference[C] / 2 - (se < te ? ne : ae) - S[C] / 2 < 0,
        B = A ? (se < te ? se - te : se - oe) : 0;
      return {
        [E]: w[E] + B,
        data: {
          [E]: ce,
          centerOffset: se - ce - B,
          ...(A && { alignmentOffset: B }),
        },
        reset: A,
      };
    },
  }),
  j2 = function (n) {
    return (
      n === void 0 && (n = {}),
      {
        name: "flip",
        options: n,
        async fn(a) {
          var i, o;
          const {
              placement: s,
              middlewareData: c,
              rects: d,
              initialPlacement: h,
              platform: m,
              elements: p,
            } = a,
            {
              mainAxis: g = !0,
              crossAxis: v = !0,
              fallbackPlacements: w,
              fallbackStrategy: E = "bestFit",
              fallbackAxisSideDirection: C = "none",
              flipAlignment: S = !0,
              ...R
            } = ir(n, a);
          if ((i = c.arrow) != null && i.alignmentOffset) return {};
          const M = lr(s),
            j = Dn(h),
            q = lr(h) === h,
            Z = await (m.isRTL == null ? void 0 : m.isRTL(p.floating)),
            Q = w || (q || !S ? [zs(h)] : E2(h)),
            V = C !== "none";
          !w && V && Q.push(..._2(h, S, C, Z));
          const N = [h, ...Q],
            U = await m.detectOverflow(a, R),
            W = [];
          let ne = ((o = c.flip) == null ? void 0 : o.overflows) || [];
          if ((g && W.push(U[M]), v)) {
            const se = w2(s, d, Z);
            W.push(U[se[0]], U[se[1]]);
          }
          if (
            ((ne = [...ne, { placement: s, overflows: W }]),
            !W.every((se) => se <= 0))
          ) {
            var ae, te;
            const se = (((ae = c.flip) == null ? void 0 : ae.index) || 0) + 1,
              ce = N[se];
            if (
              ce &&
              (!(v === "alignment" ? j !== Dn(ce) : !1) ||
                ne.every((K) =>
                  Dn(K.placement) === j ? K.overflows[0] > 0 : !0,
                ))
            )
              return {
                data: { index: se, overflows: ne },
                reset: { placement: ce },
              };
            let A =
              (te = ne
                .filter((B) => B.overflows[0] <= 0)
                .sort((B, K) => B.overflows[1] - K.overflows[1])[0]) == null
                ? void 0
                : te.placement;
            if (!A)
              switch (E) {
                case "bestFit": {
                  var oe;
                  const B =
                    (oe = ne
                      .filter((K) => {
                        if (V) {
                          const le = Dn(K.placement);
                          return le === j || le === "y";
                        }
                        return !0;
                      })
                      .map((K) => [
                        K.placement,
                        K.overflows
                          .filter((le) => le > 0)
                          .reduce((le, J) => le + J, 0),
                      ])
                      .sort((K, le) => K[1] - le[1])[0]) == null
                      ? void 0
                      : oe[0];
                  B && (A = B);
                  break;
                }
                case "initialPlacement":
                  A = h;
                  break;
              }
            if (s !== A) return { reset: { placement: A } };
          }
          return {};
        },
      }
    );
  };
function Ty(n, a) {
  return {
    top: n.top - a.height,
    right: n.right - a.width,
    bottom: n.bottom - a.height,
    left: n.left - a.width,
  };
}
function _y(n) {
  return x2.some((a) => n[a] >= 0);
}
const z2 = function (n) {
    return (
      n === void 0 && (n = {}),
      {
        name: "hide",
        options: n,
        async fn(a) {
          const { rects: i, platform: o } = a,
            { strategy: s = "referenceHidden", ...c } = ir(n, a);
          switch (s) {
            case "referenceHidden": {
              const d = await o.detectOverflow(a, {
                  ...c,
                  elementContext: "reference",
                }),
                h = Ty(d, i.reference);
              return {
                data: { referenceHiddenOffsets: h, referenceHidden: _y(h) },
              };
            }
            case "escaped": {
              const d = await o.detectOverflow(a, { ...c, altBoundary: !0 }),
                h = Ty(d, i.floating);
              return { data: { escapedOffsets: h, escaped: _y(h) } };
            }
            default:
              return {};
          }
        },
      }
    );
  },
  y0 = new Set(["left", "top"]);
async function U2(n, a) {
  const { placement: i, platform: o, elements: s } = n,
    c = await (o.isRTL == null ? void 0 : o.isRTL(s.floating)),
    d = lr(i),
    h = Ai(i),
    m = Dn(i) === "y",
    p = y0.has(d) ? -1 : 1,
    g = c && m ? -1 : 1,
    v = ir(a, n);
  let {
    mainAxis: w,
    crossAxis: E,
    alignmentAxis: C,
  } = typeof v == "number"
    ? { mainAxis: v, crossAxis: 0, alignmentAxis: null }
    : {
        mainAxis: v.mainAxis || 0,
        crossAxis: v.crossAxis || 0,
        alignmentAxis: v.alignmentAxis,
      };
  return (
    h && typeof C == "number" && (E = h === "end" ? C * -1 : C),
    m ? { x: E * g, y: w * p } : { x: w * p, y: E * g }
  );
}
const L2 = function (n) {
    return (
      n === void 0 && (n = 0),
      {
        name: "offset",
        options: n,
        async fn(a) {
          var i, o;
          const { x: s, y: c, placement: d, middlewareData: h } = a,
            m = await U2(a, n);
          return d === ((i = h.offset) == null ? void 0 : i.placement) &&
            (o = h.arrow) != null &&
            o.alignmentOffset
            ? {}
            : { x: s + m.x, y: c + m.y, data: { ...m, placement: d } };
        },
      }
    );
  },
  H2 = function (n) {
    return (
      n === void 0 && (n = {}),
      {
        name: "shift",
        options: n,
        async fn(a) {
          const { x: i, y: o, placement: s, platform: c } = a,
            {
              mainAxis: d = !0,
              crossAxis: h = !1,
              limiter: m = {
                fn: (M) => {
                  let { x: j, y: q } = M;
                  return { x: j, y: q };
                },
              },
              ...p
            } = ir(n, a),
            g = { x: i, y: o },
            v = await c.detectOverflow(a, p),
            w = Dn(lr(s)),
            E = zd(w);
          let C = g[E],
            S = g[w];
          if (d) {
            const M = E === "y" ? "top" : "left",
              j = E === "y" ? "bottom" : "right",
              q = C + v[M],
              Z = C - v[j];
            C = fd(q, C, Z);
          }
          if (h) {
            const M = w === "y" ? "top" : "left",
              j = w === "y" ? "bottom" : "right",
              q = S + v[M],
              Z = S - v[j];
            S = fd(q, S, Z);
          }
          const R = m.fn({ ...a, [E]: C, [w]: S });
          return {
            ...R,
            data: { x: R.x - i, y: R.y - o, enabled: { [E]: d, [w]: h } },
          };
        },
      }
    );
  },
  B2 = function (n) {
    return (
      n === void 0 && (n = {}),
      {
        options: n,
        fn(a) {
          const { x: i, y: o, placement: s, rects: c, middlewareData: d } = a,
            { offset: h = 0, mainAxis: m = !0, crossAxis: p = !0 } = ir(n, a),
            g = { x: i, y: o },
            v = Dn(s),
            w = zd(v);
          let E = g[w],
            C = g[v];
          const S = ir(h, a),
            R =
              typeof S == "number"
                ? { mainAxis: S, crossAxis: 0 }
                : { mainAxis: 0, crossAxis: 0, ...S };
          if (m) {
            const q = w === "y" ? "height" : "width",
              Z = c.reference[w] - c.floating[q] + R.mainAxis,
              Q = c.reference[w] + c.reference[q] - R.mainAxis;
            E < Z ? (E = Z) : E > Q && (E = Q);
          }
          if (p) {
            var M, j;
            const q = w === "y" ? "width" : "height",
              Z = y0.has(lr(s)),
              Q =
                c.reference[v] -
                c.floating[q] +
                ((Z && ((M = d.offset) == null ? void 0 : M[v])) || 0) +
                (Z ? 0 : R.crossAxis),
              V =
                c.reference[v] +
                c.reference[q] +
                (Z ? 0 : ((j = d.offset) == null ? void 0 : j[v]) || 0) -
                (Z ? R.crossAxis : 0);
            C < Q ? (C = Q) : C > V && (C = V);
          }
          return { [w]: E, [v]: C };
        },
      }
    );
  },
  q2 = function (n) {
    return (
      n === void 0 && (n = {}),
      {
        name: "size",
        options: n,
        async fn(a) {
          var i, o;
          const { placement: s, rects: c, platform: d, elements: h } = a,
            { apply: m = () => {}, ...p } = ir(n, a),
            g = await d.detectOverflow(a, p),
            v = lr(s),
            w = Ai(s),
            E = Dn(s) === "y",
            { width: C, height: S } = c.floating;
          let R, M;
          v === "top" || v === "bottom"
            ? ((R = v),
              (M =
                w ===
                ((await (d.isRTL == null ? void 0 : d.isRTL(h.floating)))
                  ? "start"
                  : "end")
                  ? "left"
                  : "right"))
            : ((M = v), (R = w === "end" ? "top" : "bottom"));
          const j = S - g.top - g.bottom,
            q = C - g.left - g.right,
            Z = Yr(S - g[R], j),
            Q = Yr(C - g[M], q),
            V = !a.middlewareData.shift;
          let N = Z,
            U = Q;
          if (
            ((i = a.middlewareData.shift) != null && i.enabled.x && (U = q),
            (o = a.middlewareData.shift) != null && o.enabled.y && (N = j),
            V && !w)
          ) {
            const ne = Zt(g.left, 0),
              ae = Zt(g.right, 0),
              te = Zt(g.top, 0),
              oe = Zt(g.bottom, 0);
            E
              ? (U =
                  C -
                  2 * (ne !== 0 || ae !== 0 ? ne + ae : Zt(g.left, g.right)))
              : (N =
                  S -
                  2 * (te !== 0 || oe !== 0 ? te + oe : Zt(g.top, g.bottom)));
          }
          await m({ ...a, availableWidth: U, availableHeight: N });
          const W = await d.getDimensions(h.floating);
          return C !== W.width || S !== W.height
            ? { reset: { rects: !0 } }
            : {};
        },
      }
    );
  };
function Fs() {
  return typeof window < "u";
}
function Ri(n) {
  return g0(n) ? (n.nodeName || "").toLowerCase() : "#document";
}
function $t(n) {
  var a;
  return (
    (n == null || (a = n.ownerDocument) == null ? void 0 : a.defaultView) ||
    window
  );
}
function Un(n) {
  var a;
  return (a = (g0(n) ? n.ownerDocument : n.document) || window.document) == null
    ? void 0
    : a.documentElement;
}
function g0(n) {
  return Fs() ? n instanceof Node || n instanceof $t(n).Node : !1;
}
function yn(n) {
  return Fs() ? n instanceof Element || n instanceof $t(n).Element : !1;
}
function sr(n) {
  return Fs() ? n instanceof HTMLElement || n instanceof $t(n).HTMLElement : !1;
}
function Ay(n) {
  return !Fs() || typeof ShadowRoot > "u"
    ? !1
    : n instanceof ShadowRoot || n instanceof $t(n).ShadowRoot;
}
function Il(n) {
  const { overflow: a, overflowX: i, overflowY: o, display: s } = gn(n);
  return (
    /auto|scroll|overlay|hidden|clip/.test(a + o + i) &&
    s !== "inline" &&
    s !== "contents"
  );
}
function P2(n) {
  return /^(table|td|th)$/.test(Ri(n));
}
function $s(n) {
  try {
    if (n.matches(":popover-open")) return !0;
  } catch {}
  try {
    return n.matches(":modal");
  } catch {
    return !1;
  }
}
const k2 = /transform|translate|scale|rotate|perspective|filter/,
  Q2 = /paint|layout|strict|content/,
  ga = (n) => !!n && n !== "none";
let Df;
function Hd(n) {
  const a = yn(n) ? gn(n) : n;
  return (
    ga(a.transform) ||
    ga(a.translate) ||
    ga(a.scale) ||
    ga(a.rotate) ||
    ga(a.perspective) ||
    (!Bd() && (ga(a.backdropFilter) || ga(a.filter))) ||
    k2.test(a.willChange || "") ||
    Q2.test(a.contain || "")
  );
}
function V2(n) {
  let a = Gr(n);
  for (; sr(a) && !Ti(a); ) {
    if (Hd(a)) return a;
    if ($s(a)) return null;
    a = Gr(a);
  }
  return null;
}
function Bd() {
  return (
    Df == null &&
      (Df =
        typeof CSS < "u" &&
        CSS.supports &&
        CSS.supports("-webkit-backdrop-filter", "none")),
    Df
  );
}
function Ti(n) {
  return /^(html|body|#document)$/.test(Ri(n));
}
function gn(n) {
  return $t(n).getComputedStyle(n);
}
function Js(n) {
  return yn(n)
    ? { scrollLeft: n.scrollLeft, scrollTop: n.scrollTop }
    : { scrollLeft: n.scrollX, scrollTop: n.scrollY };
}
function Gr(n) {
  if (Ri(n) === "html") return n;
  const a = n.assignedSlot || n.parentNode || (Ay(n) && n.host) || Un(n);
  return Ay(a) ? a.host : a;
}
function b0(n) {
  const a = Gr(n);
  return Ti(a)
    ? n.ownerDocument
      ? n.ownerDocument.body
      : n.body
    : sr(a) && Il(a)
      ? a
      : b0(a);
}
function Pl(n, a, i) {
  var o;
  (a === void 0 && (a = []), i === void 0 && (i = !0));
  const s = b0(n),
    c = s === ((o = n.ownerDocument) == null ? void 0 : o.body),
    d = $t(s);
  if (c) {
    const h = hd(d);
    return a.concat(
      d,
      d.visualViewport || [],
      Il(s) ? s : [],
      h && i ? Pl(h) : [],
    );
  } else return a.concat(s, Pl(s, [], i));
}
function hd(n) {
  return n.parent && Object.getPrototypeOf(n.parent) ? n.frameElement : null;
}
function x0(n) {
  const a = gn(n);
  let i = parseFloat(a.width) || 0,
    o = parseFloat(a.height) || 0;
  const s = sr(n),
    c = s ? n.offsetWidth : i,
    d = s ? n.offsetHeight : o,
    h = js(i) !== c || js(o) !== d;
  return (h && ((i = c), (o = d)), { width: i, height: o, $: h });
}
function qd(n) {
  return yn(n) ? n : n.contextElement;
}
function Ei(n) {
  const a = qd(n);
  if (!sr(a)) return jn(1);
  const i = a.getBoundingClientRect(),
    { width: o, height: s, $: c } = x0(a);
  let d = (c ? js(i.width) : i.width) / o,
    h = (c ? js(i.height) : i.height) / s;
  return (
    (!d || !Number.isFinite(d)) && (d = 1),
    (!h || !Number.isFinite(h)) && (h = 1),
    { x: d, y: h }
  );
}
const Y2 = jn(0);
function S0(n) {
  const a = $t(n);
  return !Bd() || !a.visualViewport
    ? Y2
    : { x: a.visualViewport.offsetLeft, y: a.visualViewport.offsetTop };
}
function G2(n, a, i) {
  return (a === void 0 && (a = !1), !i || (a && i !== $t(n)) ? !1 : a);
}
function Oa(n, a, i, o) {
  (a === void 0 && (a = !1), i === void 0 && (i = !1));
  const s = n.getBoundingClientRect(),
    c = qd(n);
  let d = jn(1);
  a && (o ? yn(o) && (d = Ei(o)) : (d = Ei(n)));
  const h = G2(c, i, o) ? S0(c) : jn(0);
  let m = (s.left + h.x) / d.x,
    p = (s.top + h.y) / d.y,
    g = s.width / d.x,
    v = s.height / d.y;
  if (c) {
    const w = $t(c),
      E = o && yn(o) ? $t(o) : o;
    let C = w,
      S = hd(C);
    for (; S && o && E !== C; ) {
      const R = Ei(S),
        M = S.getBoundingClientRect(),
        j = gn(S),
        q = M.left + (S.clientLeft + parseFloat(j.paddingLeft)) * R.x,
        Z = M.top + (S.clientTop + parseFloat(j.paddingTop)) * R.y;
      ((m *= R.x),
        (p *= R.y),
        (g *= R.x),
        (v *= R.y),
        (m += q),
        (p += Z),
        (C = $t(S)),
        (S = hd(C)));
    }
  }
  return Us({ width: g, height: v, x: m, y: p });
}
function Ws(n, a) {
  const i = Js(n).scrollLeft;
  return a ? a.left + i : Oa(Un(n)).left + i;
}
function w0(n, a) {
  const i = n.getBoundingClientRect(),
    o = i.left + a.scrollLeft - Ws(n, i),
    s = i.top + a.scrollTop;
  return { x: o, y: s };
}
function K2(n) {
  let { elements: a, rect: i, offsetParent: o, strategy: s } = n;
  const c = s === "fixed",
    d = Un(o),
    h = a ? $s(a.floating) : !1;
  if (o === d || (h && c)) return i;
  let m = { scrollLeft: 0, scrollTop: 0 },
    p = jn(1);
  const g = jn(0),
    v = sr(o);
  if ((v || (!v && !c)) && ((Ri(o) !== "body" || Il(d)) && (m = Js(o)), v)) {
    const E = Oa(o);
    ((p = Ei(o)), (g.x = E.x + o.clientLeft), (g.y = E.y + o.clientTop));
  }
  const w = d && !v && !c ? w0(d, m) : jn(0);
  return {
    width: i.width * p.x,
    height: i.height * p.y,
    x: i.x * p.x - m.scrollLeft * p.x + g.x + w.x,
    y: i.y * p.y - m.scrollTop * p.y + g.y + w.y,
  };
}
function X2(n) {
  return Array.from(n.getClientRects());
}
function I2(n) {
  const a = Un(n),
    i = Js(n),
    o = n.ownerDocument.body,
    s = Zt(a.scrollWidth, a.clientWidth, o.scrollWidth, o.clientWidth),
    c = Zt(a.scrollHeight, a.clientHeight, o.scrollHeight, o.clientHeight);
  let d = -i.scrollLeft + Ws(n);
  const h = -i.scrollTop;
  return (
    gn(o).direction === "rtl" && (d += Zt(a.clientWidth, o.clientWidth) - s),
    { width: s, height: c, x: d, y: h }
  );
}
const Ry = 25;
function Z2(n, a) {
  const i = $t(n),
    o = Un(n),
    s = i.visualViewport;
  let c = o.clientWidth,
    d = o.clientHeight,
    h = 0,
    m = 0;
  if (s) {
    ((c = s.width), (d = s.height));
    const g = Bd();
    (!g || (g && a === "fixed")) && ((h = s.offsetLeft), (m = s.offsetTop));
  }
  const p = Ws(o);
  if (p <= 0) {
    const g = o.ownerDocument,
      v = g.body,
      w = getComputedStyle(v),
      E =
        (g.compatMode === "CSS1Compat" &&
          parseFloat(w.marginLeft) + parseFloat(w.marginRight)) ||
        0,
      C = Math.abs(o.clientWidth - v.clientWidth - E);
    C <= Ry && (c -= C);
  } else p <= Ry && (c += p);
  return { width: c, height: d, x: h, y: m };
}
function F2(n, a) {
  const i = Oa(n, !0, a === "fixed"),
    o = i.top + n.clientTop,
    s = i.left + n.clientLeft,
    c = sr(n) ? Ei(n) : jn(1),
    d = n.clientWidth * c.x,
    h = n.clientHeight * c.y,
    m = s * c.x,
    p = o * c.y;
  return { width: d, height: h, x: m, y: p };
}
function My(n, a, i) {
  let o;
  if (a === "viewport") o = Z2(n, i);
  else if (a === "document") o = I2(Un(n));
  else if (yn(a)) o = F2(a, i);
  else {
    const s = S0(n);
    o = { x: a.x - s.x, y: a.y - s.y, width: a.width, height: a.height };
  }
  return Us(o);
}
function E0(n, a) {
  const i = Gr(n);
  return i === a || !yn(i) || Ti(i)
    ? !1
    : gn(i).position === "fixed" || E0(i, a);
}
function $2(n, a) {
  const i = a.get(n);
  if (i) return i;
  let o = Pl(n, [], !1).filter((h) => yn(h) && Ri(h) !== "body"),
    s = null;
  const c = gn(n).position === "fixed";
  let d = c ? Gr(n) : n;
  for (; yn(d) && !Ti(d); ) {
    const h = gn(d),
      m = Hd(d);
    (!m && h.position === "fixed" && (s = null),
      (
        c
          ? !m && !s
          : (!m &&
              h.position === "static" &&
              !!s &&
              (s.position === "absolute" || s.position === "fixed")) ||
            (Il(d) && !m && E0(n, d))
      )
        ? (o = o.filter((g) => g !== d))
        : (s = h),
      (d = Gr(d)));
  }
  return (a.set(n, o), o);
}
function J2(n) {
  let { element: a, boundary: i, rootBoundary: o, strategy: s } = n;
  const d = [
      ...(i === "clippingAncestors"
        ? $s(a)
          ? []
          : $2(a, this._c)
        : [].concat(i)),
      o,
    ],
    h = My(a, d[0], s);
  let m = h.top,
    p = h.right,
    g = h.bottom,
    v = h.left;
  for (let w = 1; w < d.length; w++) {
    const E = My(a, d[w], s);
    ((m = Zt(E.top, m)),
      (p = Yr(E.right, p)),
      (g = Yr(E.bottom, g)),
      (v = Zt(E.left, v)));
  }
  return { width: p - v, height: g - m, x: v, y: m };
}
function W2(n) {
  const { width: a, height: i } = x0(n);
  return { width: a, height: i };
}
function eC(n, a, i) {
  const o = sr(a),
    s = Un(a),
    c = i === "fixed",
    d = Oa(n, !0, c, a);
  let h = { scrollLeft: 0, scrollTop: 0 };
  const m = jn(0);
  function p() {
    m.x = Ws(s);
  }
  if (o || (!o && !c))
    if (((Ri(a) !== "body" || Il(s)) && (h = Js(a)), o)) {
      const E = Oa(a, !0, c, a);
      ((m.x = E.x + a.clientLeft), (m.y = E.y + a.clientTop));
    } else s && p();
  c && !o && s && p();
  const g = s && !o && !c ? w0(s, h) : jn(0),
    v = d.left + h.scrollLeft - m.x - g.x,
    w = d.top + h.scrollTop - m.y - g.y;
  return { x: v, y: w, width: d.width, height: d.height };
}
function jf(n) {
  return gn(n).position === "static";
}
function Ny(n, a) {
  if (!sr(n) || gn(n).position === "fixed") return null;
  if (a) return a(n);
  let i = n.offsetParent;
  return (Un(n) === i && (i = i.ownerDocument.body), i);
}
function O0(n, a) {
  const i = $t(n);
  if ($s(n)) return i;
  if (!sr(n)) {
    let s = Gr(n);
    for (; s && !Ti(s); ) {
      if (yn(s) && !jf(s)) return s;
      s = Gr(s);
    }
    return i;
  }
  let o = Ny(n, a);
  for (; o && P2(o) && jf(o); ) o = Ny(o, a);
  return o && Ti(o) && jf(o) && !Hd(o) ? i : o || V2(n) || i;
}
const tC = async function (n) {
  const a = this.getOffsetParent || O0,
    i = this.getDimensions,
    o = await i(n.floating);
  return {
    reference: eC(n.reference, await a(n.floating), n.strategy),
    floating: { x: 0, y: 0, width: o.width, height: o.height },
  };
};
function nC(n) {
  return gn(n).direction === "rtl";
}
const rC = {
  convertOffsetParentRelativeRectToViewportRelativeRect: K2,
  getDocumentElement: Un,
  getClippingRect: J2,
  getOffsetParent: O0,
  getElementRects: tC,
  getClientRects: X2,
  getDimensions: W2,
  getScale: Ei,
  isElement: yn,
  isRTL: nC,
};
function C0(n, a) {
  return (
    n.x === a.x && n.y === a.y && n.width === a.width && n.height === a.height
  );
}
function aC(n, a) {
  let i = null,
    o;
  const s = Un(n);
  function c() {
    var h;
    (clearTimeout(o), (h = i) == null || h.disconnect(), (i = null));
  }
  function d(h, m) {
    (h === void 0 && (h = !1), m === void 0 && (m = 1), c());
    const p = n.getBoundingClientRect(),
      { left: g, top: v, width: w, height: E } = p;
    if ((h || a(), !w || !E)) return;
    const C = vs(v),
      S = vs(s.clientWidth - (g + w)),
      R = vs(s.clientHeight - (v + E)),
      M = vs(g),
      q = {
        rootMargin: -C + "px " + -S + "px " + -R + "px " + -M + "px",
        threshold: Zt(0, Yr(1, m)) || 1,
      };
    let Z = !0;
    function Q(V) {
      const N = V[0].intersectionRatio;
      if (N !== m) {
        if (!Z) return d();
        N
          ? d(!1, N)
          : (o = setTimeout(() => {
              d(!1, 1e-7);
            }, 1e3));
      }
      (N === 1 && !C0(p, n.getBoundingClientRect()) && d(), (Z = !1));
    }
    try {
      i = new IntersectionObserver(Q, { ...q, root: s.ownerDocument });
    } catch {
      i = new IntersectionObserver(Q, q);
    }
    i.observe(n);
  }
  return (d(!0), c);
}
function iC(n, a, i, o) {
  o === void 0 && (o = {});
  const {
      ancestorScroll: s = !0,
      ancestorResize: c = !0,
      elementResize: d = typeof ResizeObserver == "function",
      layoutShift: h = typeof IntersectionObserver == "function",
      animationFrame: m = !1,
    } = o,
    p = qd(n),
    g = s || c ? [...(p ? Pl(p) : []), ...(a ? Pl(a) : [])] : [];
  g.forEach((M) => {
    (s && M.addEventListener("scroll", i, { passive: !0 }),
      c && M.addEventListener("resize", i));
  });
  const v = p && h ? aC(p, i) : null;
  let w = -1,
    E = null;
  d &&
    ((E = new ResizeObserver((M) => {
      let [j] = M;
      (j &&
        j.target === p &&
        E &&
        a &&
        (E.unobserve(a),
        cancelAnimationFrame(w),
        (w = requestAnimationFrame(() => {
          var q;
          (q = E) == null || q.observe(a);
        }))),
        i());
    })),
    p && !m && E.observe(p),
    a && E.observe(a));
  let C,
    S = m ? Oa(n) : null;
  m && R();
  function R() {
    const M = Oa(n);
    (S && !C0(S, M) && i(), (S = M), (C = requestAnimationFrame(R)));
  }
  return (
    i(),
    () => {
      var M;
      (g.forEach((j) => {
        (s && j.removeEventListener("scroll", i),
          c && j.removeEventListener("resize", i));
      }),
        v?.(),
        (M = E) == null || M.disconnect(),
        (E = null),
        m && cancelAnimationFrame(C));
    }
  );
}
const lC = L2,
  oC = H2,
  sC = j2,
  uC = q2,
  cC = z2,
  Dy = D2,
  fC = B2,
  dC = (n, a, i) => {
    const o = new Map(),
      s = { platform: rC, ...i },
      c = { ...s.platform, _c: o };
    return N2(n, a, { ...s, platform: c });
  };
var hC = typeof document < "u",
  mC = function () {},
  As = hC ? b.useLayoutEffect : mC;
function Ls(n, a) {
  if (n === a) return !0;
  if (typeof n != typeof a) return !1;
  if (typeof n == "function" && n.toString() === a.toString()) return !0;
  let i, o, s;
  if (n && a && typeof n == "object") {
    if (Array.isArray(n)) {
      if (((i = n.length), i !== a.length)) return !1;
      for (o = i; o-- !== 0; ) if (!Ls(n[o], a[o])) return !1;
      return !0;
    }
    if (((s = Object.keys(n)), (i = s.length), i !== Object.keys(a).length))
      return !1;
    for (o = i; o-- !== 0; ) if (!{}.hasOwnProperty.call(a, s[o])) return !1;
    for (o = i; o-- !== 0; ) {
      const c = s[o];
      if (!(c === "_owner" && n.$$typeof) && !Ls(n[c], a[c])) return !1;
    }
    return !0;
  }
  return n !== n && a !== a;
}
function T0(n) {
  return typeof window > "u"
    ? 1
    : (n.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function jy(n, a) {
  const i = T0(n);
  return Math.round(a * i) / i;
}
function zf(n) {
  const a = b.useRef(n);
  return (
    As(() => {
      a.current = n;
    }),
    a
  );
}
function pC(n) {
  n === void 0 && (n = {});
  const {
      placement: a = "bottom",
      strategy: i = "absolute",
      middleware: o = [],
      platform: s,
      elements: { reference: c, floating: d } = {},
      transform: h = !0,
      whileElementsMounted: m,
      open: p,
    } = n,
    [g, v] = b.useState({
      x: 0,
      y: 0,
      strategy: i,
      placement: a,
      middlewareData: {},
      isPositioned: !1,
    }),
    [w, E] = b.useState(o);
  Ls(w, o) || E(o);
  const [C, S] = b.useState(null),
    [R, M] = b.useState(null),
    j = b.useCallback((K) => {
      K !== V.current && ((V.current = K), S(K));
    }, []),
    q = b.useCallback((K) => {
      K !== N.current && ((N.current = K), M(K));
    }, []),
    Z = c || C,
    Q = d || R,
    V = b.useRef(null),
    N = b.useRef(null),
    U = b.useRef(g),
    W = m != null,
    ne = zf(m),
    ae = zf(s),
    te = zf(p),
    oe = b.useCallback(() => {
      if (!V.current || !N.current) return;
      const K = { placement: a, strategy: i, middleware: w };
      (ae.current && (K.platform = ae.current),
        dC(V.current, N.current, K).then((le) => {
          const J = { ...le, isPositioned: te.current !== !1 };
          se.current &&
            !Ls(U.current, J) &&
            ((U.current = J),
            Kl.flushSync(() => {
              v(J);
            }));
        }));
    }, [w, a, i, ae, te]);
  As(() => {
    p === !1 &&
      U.current.isPositioned &&
      ((U.current.isPositioned = !1), v((K) => ({ ...K, isPositioned: !1 })));
  }, [p]);
  const se = b.useRef(!1);
  (As(
    () => (
      (se.current = !0),
      () => {
        se.current = !1;
      }
    ),
    [],
  ),
    As(() => {
      if ((Z && (V.current = Z), Q && (N.current = Q), Z && Q)) {
        if (ne.current) return ne.current(Z, Q, oe);
        oe();
      }
    }, [Z, Q, oe, ne, W]));
  const ce = b.useMemo(
      () => ({ reference: V, floating: N, setReference: j, setFloating: q }),
      [j, q],
    ),
    A = b.useMemo(() => ({ reference: Z, floating: Q }), [Z, Q]),
    B = b.useMemo(() => {
      const K = { position: i, left: 0, top: 0 };
      if (!A.floating) return K;
      const le = jy(A.floating, g.x),
        J = jy(A.floating, g.y);
      return h
        ? {
            ...K,
            transform: "translate(" + le + "px, " + J + "px)",
            ...(T0(A.floating) >= 1.5 && { willChange: "transform" }),
          }
        : { position: i, left: le, top: J };
    }, [i, h, A.floating, g.x, g.y]);
  return b.useMemo(
    () => ({ ...g, update: oe, refs: ce, elements: A, floatingStyles: B }),
    [g, oe, ce, A, B],
  );
}
const vC = (n) => {
    function a(i) {
      return {}.hasOwnProperty.call(i, "current");
    }
    return {
      name: "arrow",
      options: n,
      fn(i) {
        const { element: o, padding: s } = typeof n == "function" ? n(i) : n;
        return o && a(o)
          ? o.current != null
            ? Dy({ element: o.current, padding: s }).fn(i)
            : {}
          : o
            ? Dy({ element: o, padding: s }).fn(i)
            : {};
      },
    };
  },
  yC = (n, a) => {
    const i = lC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  },
  gC = (n, a) => {
    const i = oC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  },
  bC = (n, a) => ({ fn: fC(n).fn, options: [n, a] }),
  xC = (n, a) => {
    const i = sC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  },
  SC = (n, a) => {
    const i = uC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  },
  wC = (n, a) => {
    const i = cC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  },
  EC = (n, a) => {
    const i = vC(n);
    return { name: i.name, fn: i.fn, options: [n, a] };
  };
var OC = "Arrow",
  _0 = b.forwardRef((n, a) => {
    const { children: i, width: o = 10, height: s = 5, ...c } = n;
    return O.jsx(We.svg, {
      ...c,
      ref: a,
      width: o,
      height: s,
      viewBox: "0 0 30 10",
      preserveAspectRatio: "none",
      children: n.asChild ? i : O.jsx("polygon", { points: "0,0 30,0 15,10" }),
    });
  });
_0.displayName = OC;
var CC = _0;
function TC(n) {
  const [a, i] = b.useState(void 0);
  return (
    Et(() => {
      if (n) {
        i({ width: n.offsetWidth, height: n.offsetHeight });
        const o = new ResizeObserver((s) => {
          if (!Array.isArray(s) || !s.length) return;
          const c = s[0];
          let d, h;
          if ("borderBoxSize" in c) {
            const m = c.borderBoxSize,
              p = Array.isArray(m) ? m[0] : m;
            ((d = p.inlineSize), (h = p.blockSize));
          } else ((d = n.offsetWidth), (h = n.offsetHeight));
          i({ width: d, height: h });
        });
        return (o.observe(n, { box: "border-box" }), () => o.unobserve(n));
      } else i(void 0);
    }, [n]),
    a
  );
}
var Pd = "Popper",
  [A0, eu] = Zs(Pd),
  [_C, R0] = A0(Pd),
  M0 = (n) => {
    const { __scopePopper: a, children: i } = n,
      [o, s] = b.useState(null);
    return O.jsx(_C, { scope: a, anchor: o, onAnchorChange: s, children: i });
  };
M0.displayName = Pd;
var N0 = "PopperAnchor",
  D0 = b.forwardRef((n, a) => {
    const { __scopePopper: i, virtualRef: o, ...s } = n,
      c = R0(N0, i),
      d = b.useRef(null),
      h = st(a, d),
      m = b.useRef(null);
    return (
      b.useEffect(() => {
        const p = m.current;
        ((m.current = o?.current || d.current),
          p !== m.current && c.onAnchorChange(m.current));
      }),
      o ? null : O.jsx(We.div, { ...s, ref: h })
    );
  });
D0.displayName = N0;
var kd = "PopperContent",
  [AC, RC] = A0(kd),
  j0 = b.forwardRef((n, a) => {
    const {
        __scopePopper: i,
        side: o = "bottom",
        sideOffset: s = 0,
        align: c = "center",
        alignOffset: d = 0,
        arrowPadding: h = 0,
        avoidCollisions: m = !0,
        collisionBoundary: p = [],
        collisionPadding: g = 0,
        sticky: v = "partial",
        hideWhenDetached: w = !1,
        updatePositionStrategy: E = "optimized",
        onPlaced: C,
        ...S
      } = n,
      R = R0(kd, i),
      [M, j] = b.useState(null),
      q = st(a, (re) => j(re)),
      [Z, Q] = b.useState(null),
      V = TC(Z),
      N = V?.width ?? 0,
      U = V?.height ?? 0,
      W = o + (c !== "center" ? "-" + c : ""),
      ne =
        typeof g == "number"
          ? g
          : { top: 0, right: 0, bottom: 0, left: 0, ...g },
      ae = Array.isArray(p) ? p : [p],
      te = ae.length > 0,
      oe = { padding: ne, boundary: ae.filter(NC), altBoundary: te },
      {
        refs: se,
        floatingStyles: ce,
        placement: A,
        isPositioned: B,
        middlewareData: K,
      } = pC({
        strategy: "fixed",
        placement: W,
        whileElementsMounted: (...re) =>
          iC(...re, { animationFrame: E === "always" }),
        elements: { reference: R.anchor },
        middleware: [
          yC({ mainAxis: s + U, alignmentAxis: d }),
          m &&
            gC({
              mainAxis: !0,
              crossAxis: !1,
              limiter: v === "partial" ? bC() : void 0,
              ...oe,
            }),
          m && xC({ ...oe }),
          SC({
            ...oe,
            apply: ({
              elements: re,
              rects: de,
              availableWidth: pe,
              availableHeight: Oe,
            }) => {
              const { width: Ce, height: Re } = de.reference,
                et = re.floating.style;
              (et.setProperty("--radix-popper-available-width", `${pe}px`),
                et.setProperty("--radix-popper-available-height", `${Oe}px`),
                et.setProperty("--radix-popper-anchor-width", `${Ce}px`),
                et.setProperty("--radix-popper-anchor-height", `${Re}px`));
            },
          }),
          Z && EC({ element: Z, padding: h }),
          DC({ arrowWidth: N, arrowHeight: U }),
          w && wC({ strategy: "referenceHidden", ...oe }),
        ],
      }),
      [le, J] = L0(A),
      T = Ea(C);
    Et(() => {
      B && T?.();
    }, [B, T]);
    const G = K.arrow?.x,
      k = K.arrow?.y,
      I = K.arrow?.centerOffset !== 0,
      [ee, ue] = b.useState();
    return (
      Et(() => {
        M && ue(window.getComputedStyle(M).zIndex);
      }, [M]),
      O.jsx("div", {
        ref: se.setFloating,
        "data-radix-popper-content-wrapper": "",
        style: {
          ...ce,
          transform: B ? ce.transform : "translate(0, -200%)",
          minWidth: "max-content",
          zIndex: ee,
          "--radix-popper-transform-origin": [
            K.transformOrigin?.x,
            K.transformOrigin?.y,
          ].join(" "),
          ...(K.hide?.referenceHidden && {
            visibility: "hidden",
            pointerEvents: "none",
          }),
        },
        dir: n.dir,
        children: O.jsx(AC, {
          scope: i,
          placedSide: le,
          onArrowChange: Q,
          arrowX: G,
          arrowY: k,
          shouldHideArrow: I,
          children: O.jsx(We.div, {
            "data-side": le,
            "data-align": J,
            ...S,
            ref: q,
            style: { ...S.style, animation: B ? void 0 : "none" },
          }),
        }),
      })
    );
  });
j0.displayName = kd;
var z0 = "PopperArrow",
  MC = { top: "bottom", right: "left", bottom: "top", left: "right" },
  U0 = b.forwardRef(function (a, i) {
    const { __scopePopper: o, ...s } = a,
      c = RC(z0, o),
      d = MC[c.placedSide];
    return O.jsx("span", {
      ref: c.onArrowChange,
      style: {
        position: "absolute",
        left: c.arrowX,
        top: c.arrowY,
        [d]: 0,
        transformOrigin: {
          top: "",
          right: "0 0",
          bottom: "center 0",
          left: "100% 0",
        }[c.placedSide],
        transform: {
          top: "translateY(100%)",
          right: "translateY(50%) rotate(90deg) translateX(-50%)",
          bottom: "rotate(180deg)",
          left: "translateY(50%) rotate(-90deg) translateX(50%)",
        }[c.placedSide],
        visibility: c.shouldHideArrow ? "hidden" : void 0,
      },
      children: O.jsx(CC, {
        ...s,
        ref: i,
        style: { ...s.style, display: "block" },
      }),
    });
  });
U0.displayName = z0;
function NC(n) {
  return n !== null;
}
var DC = (n) => ({
  name: "transformOrigin",
  options: n,
  fn(a) {
    const { placement: i, rects: o, middlewareData: s } = a,
      d = s.arrow?.centerOffset !== 0,
      h = d ? 0 : n.arrowWidth,
      m = d ? 0 : n.arrowHeight,
      [p, g] = L0(i),
      v = { start: "0%", center: "50%", end: "100%" }[g],
      w = (s.arrow?.x ?? 0) + h / 2,
      E = (s.arrow?.y ?? 0) + m / 2;
    let C = "",
      S = "";
    return (
      p === "bottom"
        ? ((C = d ? v : `${w}px`), (S = `${-m}px`))
        : p === "top"
          ? ((C = d ? v : `${w}px`), (S = `${o.floating.height + m}px`))
          : p === "right"
            ? ((C = `${-m}px`), (S = d ? v : `${E}px`))
            : p === "left" &&
              ((C = `${o.floating.width + m}px`), (S = d ? v : `${E}px`)),
      { data: { x: C, y: S } }
    );
  },
});
function L0(n) {
  const [a, i = "center"] = n.split("-");
  return [a, i];
}
var jC = M0,
  H0 = D0,
  B0 = j0,
  q0 = U0,
  zC = "Portal",
  P0 = b.forwardRef((n, a) => {
    const { container: i, ...o } = n,
      [s, c] = b.useState(!1);
    Et(() => c(!0), []);
    const d = i || (s && globalThis?.document?.body);
    return d ? h0.createPortal(O.jsx(We.div, { ...o, ref: a }), d) : null;
  });
P0.displayName = zC;
function UC(n, a) {
  return b.useReducer((i, o) => a[i][o] ?? i, n);
}
var k0 = (n) => {
  const { present: a, children: i } = n,
    o = LC(a),
    s =
      typeof i == "function" ? i({ present: o.isPresent }) : b.Children.only(i),
    c = st(o.ref, HC(s));
  return typeof i == "function" || o.isPresent
    ? b.cloneElement(s, { ref: c })
    : null;
};
k0.displayName = "Presence";
function LC(n) {
  const [a, i] = b.useState(),
    o = b.useRef(null),
    s = b.useRef(n),
    c = b.useRef("none"),
    d = n ? "mounted" : "unmounted",
    [h, m] = UC(d, {
      mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
      unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
      unmounted: { MOUNT: "mounted" },
    });
  return (
    b.useEffect(() => {
      const p = ys(o.current);
      c.current = h === "mounted" ? p : "none";
    }, [h]),
    Et(() => {
      const p = o.current,
        g = s.current;
      if (g !== n) {
        const w = c.current,
          E = ys(p);
        (n
          ? m("MOUNT")
          : E === "none" || p?.display === "none"
            ? m("UNMOUNT")
            : m(g && w !== E ? "ANIMATION_OUT" : "UNMOUNT"),
          (s.current = n));
      }
    }, [n, m]),
    Et(() => {
      if (a) {
        let p;
        const g = a.ownerDocument.defaultView ?? window,
          v = (E) => {
            const S = ys(o.current).includes(CSS.escape(E.animationName));
            if (E.target === a && S && (m("ANIMATION_END"), !s.current)) {
              const R = a.style.animationFillMode;
              ((a.style.animationFillMode = "forwards"),
                (p = g.setTimeout(() => {
                  a.style.animationFillMode === "forwards" &&
                    (a.style.animationFillMode = R);
                })));
            }
          },
          w = (E) => {
            E.target === a && (c.current = ys(o.current));
          };
        return (
          a.addEventListener("animationstart", w),
          a.addEventListener("animationcancel", v),
          a.addEventListener("animationend", v),
          () => {
            (g.clearTimeout(p),
              a.removeEventListener("animationstart", w),
              a.removeEventListener("animationcancel", v),
              a.removeEventListener("animationend", v));
          }
        );
      } else m("ANIMATION_END");
    }, [a, m]),
    {
      isPresent: ["mounted", "unmountSuspended"].includes(h),
      ref: b.useCallback((p) => {
        ((o.current = p ? getComputedStyle(p) : null), i(p));
      }, []),
    }
  );
}
function ys(n) {
  return n?.animationName || "none";
}
function HC(n) {
  let a = Object.getOwnPropertyDescriptor(n.props, "ref")?.get,
    i = a && "isReactWarning" in a && a.isReactWarning;
  return i
    ? n.ref
    : ((a = Object.getOwnPropertyDescriptor(n, "ref")?.get),
      (i = a && "isReactWarning" in a && a.isReactWarning),
      i ? n.props.ref : n.props.ref || n.ref);
}
var BC = Symbol("radix.slottable");
function qC(n) {
  const a = ({ children: i }) => O.jsx(O.Fragment, { children: i });
  return ((a.displayName = `${n}.Slottable`), (a.__radixId = BC), a);
}
var PC = Ql[" useInsertionEffect ".trim().toString()] || Et;
function zy({ prop: n, defaultProp: a, onChange: i = () => {}, caller: o }) {
  const [s, c, d] = kC({ defaultProp: a, onChange: i }),
    h = n !== void 0,
    m = h ? n : s;
  {
    const g = b.useRef(n !== void 0);
    b.useEffect(() => {
      const v = g.current;
      (v !== h &&
        console.warn(
          `${o} is changing from ${v ? "controlled" : "uncontrolled"} to ${h ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`,
        ),
        (g.current = h));
    }, [h, o]);
  }
  const p = b.useCallback(
    (g) => {
      if (h) {
        const v = QC(g) ? g(n) : g;
        v !== n && d.current?.(v);
      } else c(g);
    },
    [h, n, c, d],
  );
  return [m, p];
}
function kC({ defaultProp: n, onChange: a }) {
  const [i, o] = b.useState(n),
    s = b.useRef(i),
    c = b.useRef(a);
  return (
    PC(() => {
      c.current = a;
    }, [a]),
    b.useEffect(() => {
      s.current !== i && (c.current?.(i), (s.current = i));
    }, [i, s]),
    [i, o, c]
  );
}
function QC(n) {
  return typeof n == "function";
}
var Q0 = Object.freeze({
    position: "absolute",
    border: 0,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    wordWrap: "normal",
  }),
  VC = "VisuallyHidden",
  V0 = b.forwardRef((n, a) =>
    O.jsx(We.span, { ...n, ref: a, style: { ...Q0, ...n.style } }),
  );
V0.displayName = VC;
var YC = V0,
  [tu] = Zs("Tooltip", [eu]),
  Qd = eu(),
  Y0 = "TooltipProvider",
  GC = 700,
  Uy = "tooltip.open",
  [KC, G0] = tu(Y0),
  K0 = (n) => {
    const {
        __scopeTooltip: a,
        delayDuration: i = GC,
        skipDelayDuration: o = 300,
        disableHoverableContent: s = !1,
        children: c,
      } = n,
      d = b.useRef(!0),
      h = b.useRef(!1),
      m = b.useRef(0);
    return (
      b.useEffect(() => {
        const p = m.current;
        return () => window.clearTimeout(p);
      }, []),
      O.jsx(KC, {
        scope: a,
        isOpenDelayedRef: d,
        delayDuration: i,
        onOpen: b.useCallback(() => {
          (window.clearTimeout(m.current), (d.current = !1));
        }, []),
        onClose: b.useCallback(() => {
          (window.clearTimeout(m.current),
            (m.current = window.setTimeout(() => (d.current = !0), o)));
        }, [o]),
        isPointerInTransitRef: h,
        onPointerInTransitChange: b.useCallback((p) => {
          h.current = p;
        }, []),
        disableHoverableContent: s,
        children: c,
      })
    );
  };
K0.displayName = Y0;
var X0 = "Tooltip",
  [eM, nu] = tu(X0),
  md = "TooltipTrigger",
  XC = b.forwardRef((n, a) => {
    const { __scopeTooltip: i, ...o } = n,
      s = nu(md, i),
      c = G0(md, i),
      d = Qd(i),
      h = b.useRef(null),
      m = st(a, h, s.onTriggerChange),
      p = b.useRef(!1),
      g = b.useRef(!1),
      v = b.useCallback(() => (p.current = !1), []);
    return (
      b.useEffect(
        () => () => document.removeEventListener("pointerup", v),
        [v],
      ),
      O.jsx(H0, {
        asChild: !0,
        ...d,
        children: O.jsx(We.button, {
          "aria-describedby": s.open ? s.contentId : void 0,
          "data-state": s.stateAttribute,
          ...o,
          ref: m,
          onPointerMove: Ve(n.onPointerMove, (w) => {
            w.pointerType !== "touch" &&
              !g.current &&
              !c.isPointerInTransitRef.current &&
              (s.onTriggerEnter(), (g.current = !0));
          }),
          onPointerLeave: Ve(n.onPointerLeave, () => {
            (s.onTriggerLeave(), (g.current = !1));
          }),
          onPointerDown: Ve(n.onPointerDown, () => {
            (s.open && s.onClose(),
              (p.current = !0),
              document.addEventListener("pointerup", v, { once: !0 }));
          }),
          onFocus: Ve(n.onFocus, () => {
            p.current || s.onOpen();
          }),
          onBlur: Ve(n.onBlur, s.onClose),
          onClick: Ve(n.onClick, s.onClose),
        }),
      })
    );
  });
XC.displayName = md;
var IC = "TooltipPortal",
  [tM, ZC] = tu(IC, { forceMount: void 0 }),
  _i = "TooltipContent",
  FC = b.forwardRef((n, a) => {
    const i = ZC(_i, n.__scopeTooltip),
      { forceMount: o = i.forceMount, side: s = "top", ...c } = n,
      d = nu(_i, n.__scopeTooltip);
    return O.jsx(k0, {
      present: o || d.open,
      children: d.disableHoverableContent
        ? O.jsx(I0, { side: s, ...c, ref: a })
        : O.jsx($C, { side: s, ...c, ref: a }),
    });
  }),
  $C = b.forwardRef((n, a) => {
    const i = nu(_i, n.__scopeTooltip),
      o = G0(_i, n.__scopeTooltip),
      s = b.useRef(null),
      c = st(a, s),
      [d, h] = b.useState(null),
      { trigger: m, onClose: p } = i,
      g = s.current,
      { onPointerInTransitChange: v } = o,
      w = b.useCallback(() => {
        (h(null), v(!1));
      }, [v]),
      E = b.useCallback(
        (C, S) => {
          const R = C.currentTarget,
            M = { x: C.clientX, y: C.clientY },
            j = nT(M, R.getBoundingClientRect()),
            q = rT(M, j),
            Z = aT(S.getBoundingClientRect()),
            Q = lT([...q, ...Z]);
          (h(Q), v(!0));
        },
        [v],
      );
    return (
      b.useEffect(() => () => w(), [w]),
      b.useEffect(() => {
        if (m && g) {
          const C = (R) => E(R, g),
            S = (R) => E(R, m);
          return (
            m.addEventListener("pointerleave", C),
            g.addEventListener("pointerleave", S),
            () => {
              (m.removeEventListener("pointerleave", C),
                g.removeEventListener("pointerleave", S));
            }
          );
        }
      }, [m, g, E, w]),
      b.useEffect(() => {
        if (d) {
          const C = (S) => {
            const R = S.target,
              M = { x: S.clientX, y: S.clientY },
              j = m?.contains(R) || g?.contains(R),
              q = !iT(M, d);
            j ? w() : q && (w(), p());
          };
          return (
            document.addEventListener("pointermove", C),
            () => document.removeEventListener("pointermove", C)
          );
        }
      }, [m, g, d, p, w]),
      O.jsx(I0, { ...n, ref: c })
    );
  }),
  [JC, WC] = tu(X0, { isInside: !1 }),
  eT = qC("TooltipContent"),
  I0 = b.forwardRef((n, a) => {
    const {
        __scopeTooltip: i,
        children: o,
        "aria-label": s,
        onEscapeKeyDown: c,
        onPointerDownOutside: d,
        ...h
      } = n,
      m = nu(_i, i),
      p = Qd(i),
      { onClose: g } = m;
    return (
      b.useEffect(
        () => (
          document.addEventListener(Uy, g),
          () => document.removeEventListener(Uy, g)
        ),
        [g],
      ),
      b.useEffect(() => {
        if (m.trigger) {
          const v = (w) => {
            w.target?.contains(m.trigger) && g();
          };
          return (
            window.addEventListener("scroll", v, { capture: !0 }),
            () => window.removeEventListener("scroll", v, { capture: !0 })
          );
        }
      }, [m.trigger, g]),
      O.jsx(Dd, {
        asChild: !0,
        disableOutsidePointerEvents: !1,
        onEscapeKeyDown: c,
        onPointerDownOutside: d,
        onFocusOutside: (v) => v.preventDefault(),
        onDismiss: g,
        children: O.jsxs(B0, {
          "data-state": m.stateAttribute,
          ...p,
          ...h,
          ref: a,
          style: {
            ...h.style,
            "--radix-tooltip-content-transform-origin":
              "var(--radix-popper-transform-origin)",
            "--radix-tooltip-content-available-width":
              "var(--radix-popper-available-width)",
            "--radix-tooltip-content-available-height":
              "var(--radix-popper-available-height)",
            "--radix-tooltip-trigger-width": "var(--radix-popper-anchor-width)",
            "--radix-tooltip-trigger-height":
              "var(--radix-popper-anchor-height)",
          },
          children: [
            O.jsx(eT, { children: o }),
            O.jsx(JC, {
              scope: i,
              isInside: !0,
              children: O.jsx(YC, {
                id: m.contentId,
                role: "tooltip",
                children: s || o,
              }),
            }),
          ],
        }),
      })
    );
  });
FC.displayName = _i;
var Z0 = "TooltipArrow",
  tT = b.forwardRef((n, a) => {
    const { __scopeTooltip: i, ...o } = n,
      s = Qd(i);
    return WC(Z0, i).isInside ? null : O.jsx(q0, { ...s, ...o, ref: a });
  });
tT.displayName = Z0;
function nT(n, a) {
  const i = Math.abs(a.top - n.y),
    o = Math.abs(a.bottom - n.y),
    s = Math.abs(a.right - n.x),
    c = Math.abs(a.left - n.x);
  switch (Math.min(i, o, s, c)) {
    case c:
      return "left";
    case s:
      return "right";
    case i:
      return "top";
    case o:
      return "bottom";
    default:
      throw new Error("unreachable");
  }
}
function rT(n, a, i = 5) {
  const o = [];
  switch (a) {
    case "top":
      o.push({ x: n.x - i, y: n.y + i }, { x: n.x + i, y: n.y + i });
      break;
    case "bottom":
      o.push({ x: n.x - i, y: n.y - i }, { x: n.x + i, y: n.y - i });
      break;
    case "left":
      o.push({ x: n.x + i, y: n.y - i }, { x: n.x + i, y: n.y + i });
      break;
    case "right":
      o.push({ x: n.x - i, y: n.y - i }, { x: n.x - i, y: n.y + i });
      break;
  }
  return o;
}
function aT(n) {
  const { top: a, right: i, bottom: o, left: s } = n;
  return [
    { x: s, y: a },
    { x: i, y: a },
    { x: i, y: o },
    { x: s, y: o },
  ];
}
function iT(n, a) {
  const { x: i, y: o } = n;
  let s = !1;
  for (let c = 0, d = a.length - 1; c < a.length; d = c++) {
    const h = a[c],
      m = a[d],
      p = h.x,
      g = h.y,
      v = m.x,
      w = m.y;
    g > o != w > o && i < ((v - p) * (o - g)) / (w - g) + p && (s = !s);
  }
  return s;
}
function lT(n) {
  const a = n.slice();
  return (
    a.sort((i, o) =>
      i.x < o.x ? -1 : i.x > o.x ? 1 : i.y < o.y ? -1 : i.y > o.y ? 1 : 0,
    ),
    oT(a)
  );
}
function oT(n) {
  if (n.length <= 1) return n.slice();
  const a = [];
  for (let o = 0; o < n.length; o++) {
    const s = n[o];
    for (; a.length >= 2; ) {
      const c = a[a.length - 1],
        d = a[a.length - 2];
      if ((c.x - d.x) * (s.y - d.y) >= (c.y - d.y) * (s.x - d.x)) a.pop();
      else break;
    }
    a.push(s);
  }
  a.pop();
  const i = [];
  for (let o = n.length - 1; o >= 0; o--) {
    const s = n[o];
    for (; i.length >= 2; ) {
      const c = i[i.length - 1],
        d = i[i.length - 2];
      if ((c.x - d.x) * (s.y - d.y) >= (c.y - d.y) * (s.x - d.x)) i.pop();
      else break;
    }
    i.push(s);
  }
  return (
    i.pop(),
    a.length === 1 && i.length === 1 && a[0].x === i[0].x && a[0].y === i[0].y
      ? a
      : a.concat(i)
  );
}
var sT = K0;
function F0(n) {
  var a,
    i,
    o = "";
  if (typeof n == "string" || typeof n == "number") o += n;
  else if (typeof n == "object")
    if (Array.isArray(n)) {
      var s = n.length;
      for (a = 0; a < s; a++)
        n[a] && (i = F0(n[a])) && (o && (o += " "), (o += i));
    } else for (i in n) n[i] && (o && (o += " "), (o += i));
  return o;
}
function $0() {
  for (var n, a, i = 0, o = "", s = arguments.length; i < s; i++)
    (n = arguments[i]) && (a = F0(n)) && (o && (o += " "), (o += a));
  return o;
}
const uT = (n, a) => {
    const i = new Array(n.length + a.length);
    for (let o = 0; o < n.length; o++) i[o] = n[o];
    for (let o = 0; o < a.length; o++) i[n.length + o] = a[o];
    return i;
  },
  cT = (n, a) => ({ classGroupId: n, validator: a }),
  J0 = (n = new Map(), a = null, i) => ({
    nextPart: n,
    validators: a,
    classGroupId: i,
  }),
  Hs = "-",
  Ly = [],
  fT = "arbitrary..",
  dT = (n) => {
    const a = mT(n),
      { conflictingClassGroups: i, conflictingClassGroupModifiers: o } = n;
    return {
      getClassGroupId: (d) => {
        if (d.startsWith("[") && d.endsWith("]")) return hT(d);
        const h = d.split(Hs),
          m = h[0] === "" && h.length > 1 ? 1 : 0;
        return W0(h, m, a);
      },
      getConflictingClassGroupIds: (d, h) => {
        if (h) {
          const m = o[d],
            p = i[d];
          return m ? (p ? uT(p, m) : m) : p || Ly;
        }
        return i[d] || Ly;
      },
    };
  },
  W0 = (n, a, i) => {
    if (n.length - a === 0) return i.classGroupId;
    const s = n[a],
      c = i.nextPart.get(s);
    if (c) {
      const p = W0(n, a + 1, c);
      if (p) return p;
    }
    const d = i.validators;
    if (d === null) return;
    const h = a === 0 ? n.join(Hs) : n.slice(a).join(Hs),
      m = d.length;
    for (let p = 0; p < m; p++) {
      const g = d[p];
      if (g.validator(h)) return g.classGroupId;
    }
  },
  hT = (n) =>
    n.slice(1, -1).indexOf(":") === -1
      ? void 0
      : (() => {
          const a = n.slice(1, -1),
            i = a.indexOf(":"),
            o = a.slice(0, i);
          return o ? fT + o : void 0;
        })(),
  mT = (n) => {
    const { theme: a, classGroups: i } = n;
    return pT(i, a);
  },
  pT = (n, a) => {
    const i = J0();
    for (const o in n) {
      const s = n[o];
      Vd(s, i, o, a);
    }
    return i;
  },
  Vd = (n, a, i, o) => {
    const s = n.length;
    for (let c = 0; c < s; c++) {
      const d = n[c];
      vT(d, a, i, o);
    }
  },
  vT = (n, a, i, o) => {
    if (typeof n == "string") {
      yT(n, a, i);
      return;
    }
    if (typeof n == "function") {
      gT(n, a, i, o);
      return;
    }
    bT(n, a, i, o);
  },
  yT = (n, a, i) => {
    const o = n === "" ? a : eb(a, n);
    o.classGroupId = i;
  },
  gT = (n, a, i, o) => {
    if (xT(n)) {
      Vd(n(o), a, i, o);
      return;
    }
    (a.validators === null && (a.validators = []), a.validators.push(cT(i, n)));
  },
  bT = (n, a, i, o) => {
    const s = Object.entries(n),
      c = s.length;
    for (let d = 0; d < c; d++) {
      const [h, m] = s[d];
      Vd(m, eb(a, h), i, o);
    }
  },
  eb = (n, a) => {
    let i = n;
    const o = a.split(Hs),
      s = o.length;
    for (let c = 0; c < s; c++) {
      const d = o[c];
      let h = i.nextPart.get(d);
      (h || ((h = J0()), i.nextPart.set(d, h)), (i = h));
    }
    return i;
  },
  xT = (n) => "isThemeGetter" in n && n.isThemeGetter === !0,
  ST = (n) => {
    if (n < 1) return { get: () => {}, set: () => {} };
    let a = 0,
      i = Object.create(null),
      o = Object.create(null);
    const s = (c, d) => {
      ((i[c] = d), a++, a > n && ((a = 0), (o = i), (i = Object.create(null))));
    };
    return {
      get(c) {
        let d = i[c];
        if (d !== void 0) return d;
        if ((d = o[c]) !== void 0) return (s(c, d), d);
      },
      set(c, d) {
        c in i ? (i[c] = d) : s(c, d);
      },
    };
  },
  pd = "!",
  Hy = ":",
  wT = [],
  By = (n, a, i, o, s) => ({
    modifiers: n,
    hasImportantModifier: a,
    baseClassName: i,
    maybePostfixModifierPosition: o,
    isExternal: s,
  }),
  ET = (n) => {
    const { prefix: a, experimentalParseClassName: i } = n;
    let o = (s) => {
      const c = [];
      let d = 0,
        h = 0,
        m = 0,
        p;
      const g = s.length;
      for (let S = 0; S < g; S++) {
        const R = s[S];
        if (d === 0 && h === 0) {
          if (R === Hy) {
            (c.push(s.slice(m, S)), (m = S + 1));
            continue;
          }
          if (R === "/") {
            p = S;
            continue;
          }
        }
        R === "[" ? d++ : R === "]" ? d-- : R === "(" ? h++ : R === ")" && h--;
      }
      const v = c.length === 0 ? s : s.slice(m);
      let w = v,
        E = !1;
      v.endsWith(pd)
        ? ((w = v.slice(0, -1)), (E = !0))
        : v.startsWith(pd) && ((w = v.slice(1)), (E = !0));
      const C = p && p > m ? p - m : void 0;
      return By(c, E, w, C);
    };
    if (a) {
      const s = a + Hy,
        c = o;
      o = (d) =>
        d.startsWith(s) ? c(d.slice(s.length)) : By(wT, !1, d, void 0, !0);
    }
    if (i) {
      const s = o;
      o = (c) => i({ className: c, parseClassName: s });
    }
    return o;
  },
  OT = (n) => {
    const a = new Map();
    return (
      n.orderSensitiveModifiers.forEach((i, o) => {
        a.set(i, 1e6 + o);
      }),
      (i) => {
        const o = [];
        let s = [];
        for (let c = 0; c < i.length; c++) {
          const d = i[c],
            h = d[0] === "[",
            m = a.has(d);
          h || m
            ? (s.length > 0 && (s.sort(), o.push(...s), (s = [])), o.push(d))
            : s.push(d);
        }
        return (s.length > 0 && (s.sort(), o.push(...s)), o);
      }
    );
  },
  CT = (n) => ({
    cache: ST(n.cacheSize),
    parseClassName: ET(n),
    sortModifiers: OT(n),
    ...dT(n),
  }),
  TT = /\s+/,
  _T = (n, a) => {
    const {
        parseClassName: i,
        getClassGroupId: o,
        getConflictingClassGroupIds: s,
        sortModifiers: c,
      } = a,
      d = [],
      h = n.trim().split(TT);
    let m = "";
    for (let p = h.length - 1; p >= 0; p -= 1) {
      const g = h[p],
        {
          isExternal: v,
          modifiers: w,
          hasImportantModifier: E,
          baseClassName: C,
          maybePostfixModifierPosition: S,
        } = i(g);
      if (v) {
        m = g + (m.length > 0 ? " " + m : m);
        continue;
      }
      let R = !!S,
        M = o(R ? C.substring(0, S) : C);
      if (!M) {
        if (!R) {
          m = g + (m.length > 0 ? " " + m : m);
          continue;
        }
        if (((M = o(C)), !M)) {
          m = g + (m.length > 0 ? " " + m : m);
          continue;
        }
        R = !1;
      }
      const j = w.length === 0 ? "" : w.length === 1 ? w[0] : c(w).join(":"),
        q = E ? j + pd : j,
        Z = q + M;
      if (d.indexOf(Z) > -1) continue;
      d.push(Z);
      const Q = s(M, R);
      for (let V = 0; V < Q.length; ++V) {
        const N = Q[V];
        d.push(q + N);
      }
      m = g + (m.length > 0 ? " " + m : m);
    }
    return m;
  },
  AT = (...n) => {
    let a = 0,
      i,
      o,
      s = "";
    for (; a < n.length; )
      (i = n[a++]) && (o = tb(i)) && (s && (s += " "), (s += o));
    return s;
  },
  tb = (n) => {
    if (typeof n == "string") return n;
    let a,
      i = "";
    for (let o = 0; o < n.length; o++)
      n[o] && (a = tb(n[o])) && (i && (i += " "), (i += a));
    return i;
  },
  RT = (n, ...a) => {
    let i, o, s, c;
    const d = (m) => {
        const p = a.reduce((g, v) => v(g), n());
        return (
          (i = CT(p)),
          (o = i.cache.get),
          (s = i.cache.set),
          (c = h),
          h(m)
        );
      },
      h = (m) => {
        const p = o(m);
        if (p) return p;
        const g = _T(m, i);
        return (s(m, g), g);
      };
    return ((c = d), (...m) => c(AT(...m)));
  },
  MT = [],
  ct = (n) => {
    const a = (i) => i[n] || MT;
    return ((a.isThemeGetter = !0), a);
  },
  nb = /^\[(?:(\w[\w-]*):)?(.+)\]$/i,
  rb = /^\((?:(\w[\w-]*):)?(.+)\)$/i,
  NT = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,
  DT = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
  jT =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
  zT = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,
  UT = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
  LT =
    /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
  Lr = (n) => NT.test(n),
  Te = (n) => !!n && !Number.isNaN(Number(n)),
  Hr = (n) => !!n && Number.isInteger(Number(n)),
  Uf = (n) => n.endsWith("%") && Te(n.slice(0, -1)),
  nr = (n) => DT.test(n),
  ab = () => !0,
  HT = (n) => jT.test(n) && !zT.test(n),
  Yd = () => !1,
  BT = (n) => UT.test(n),
  qT = (n) => LT.test(n),
  PT = (n) => !me(n) && !ve(n),
  kT = (n) => Xr(n, ob, Yd),
  me = (n) => nb.test(n),
  ba = (n) => Xr(n, sb, HT),
  qy = (n) => Xr(n, ZT, Te),
  QT = (n) => Xr(n, cb, ab),
  VT = (n) => Xr(n, ub, Yd),
  Py = (n) => Xr(n, ib, Yd),
  YT = (n) => Xr(n, lb, qT),
  gs = (n) => Xr(n, fb, BT),
  ve = (n) => rb.test(n),
  Al = (n) => Ma(n, sb),
  GT = (n) => Ma(n, ub),
  ky = (n) => Ma(n, ib),
  KT = (n) => Ma(n, ob),
  XT = (n) => Ma(n, lb),
  bs = (n) => Ma(n, fb, !0),
  IT = (n) => Ma(n, cb, !0),
  Xr = (n, a, i) => {
    const o = nb.exec(n);
    return o ? (o[1] ? a(o[1]) : i(o[2])) : !1;
  },
  Ma = (n, a, i = !1) => {
    const o = rb.exec(n);
    return o ? (o[1] ? a(o[1]) : i) : !1;
  },
  ib = (n) => n === "position" || n === "percentage",
  lb = (n) => n === "image" || n === "url",
  ob = (n) => n === "length" || n === "size" || n === "bg-size",
  sb = (n) => n === "length",
  ZT = (n) => n === "number",
  ub = (n) => n === "family-name",
  cb = (n) => n === "number" || n === "weight",
  fb = (n) => n === "shadow",
  FT = () => {
    const n = ct("color"),
      a = ct("font"),
      i = ct("text"),
      o = ct("font-weight"),
      s = ct("tracking"),
      c = ct("leading"),
      d = ct("breakpoint"),
      h = ct("container"),
      m = ct("spacing"),
      p = ct("radius"),
      g = ct("shadow"),
      v = ct("inset-shadow"),
      w = ct("text-shadow"),
      E = ct("drop-shadow"),
      C = ct("blur"),
      S = ct("perspective"),
      R = ct("aspect"),
      M = ct("ease"),
      j = ct("animate"),
      q = () => [
        "auto",
        "avoid",
        "all",
        "avoid-page",
        "page",
        "left",
        "right",
        "column",
      ],
      Z = () => [
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "top-left",
        "left-top",
        "top-right",
        "right-top",
        "bottom-right",
        "right-bottom",
        "bottom-left",
        "left-bottom",
      ],
      Q = () => [...Z(), ve, me],
      V = () => ["auto", "hidden", "clip", "visible", "scroll"],
      N = () => ["auto", "contain", "none"],
      U = () => [ve, me, m],
      W = () => [Lr, "full", "auto", ...U()],
      ne = () => [Hr, "none", "subgrid", ve, me],
      ae = () => ["auto", { span: ["full", Hr, ve, me] }, Hr, ve, me],
      te = () => [Hr, "auto", ve, me],
      oe = () => ["auto", "min", "max", "fr", ve, me],
      se = () => [
        "start",
        "end",
        "center",
        "between",
        "around",
        "evenly",
        "stretch",
        "baseline",
        "center-safe",
        "end-safe",
      ],
      ce = () => [
        "start",
        "end",
        "center",
        "stretch",
        "center-safe",
        "end-safe",
      ],
      A = () => ["auto", ...U()],
      B = () => [
        Lr,
        "auto",
        "full",
        "dvw",
        "dvh",
        "lvw",
        "lvh",
        "svw",
        "svh",
        "min",
        "max",
        "fit",
        ...U(),
      ],
      K = () => [
        Lr,
        "screen",
        "full",
        "dvw",
        "lvw",
        "svw",
        "min",
        "max",
        "fit",
        ...U(),
      ],
      le = () => [
        Lr,
        "screen",
        "full",
        "lh",
        "dvh",
        "lvh",
        "svh",
        "min",
        "max",
        "fit",
        ...U(),
      ],
      J = () => [n, ve, me],
      T = () => [...Z(), ky, Py, { position: [ve, me] }],
      G = () => ["no-repeat", { repeat: ["", "x", "y", "space", "round"] }],
      k = () => ["auto", "cover", "contain", KT, kT, { size: [ve, me] }],
      I = () => [Uf, Al, ba],
      ee = () => ["", "none", "full", p, ve, me],
      ue = () => ["", Te, Al, ba],
      re = () => ["solid", "dashed", "dotted", "double"],
      de = () => [
        "normal",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
        "color-dodge",
        "color-burn",
        "hard-light",
        "soft-light",
        "difference",
        "exclusion",
        "hue",
        "saturation",
        "color",
        "luminosity",
      ],
      pe = () => [Te, Uf, ky, Py],
      Oe = () => ["", "none", C, ve, me],
      Ce = () => ["none", Te, ve, me],
      Re = () => ["none", Te, ve, me],
      et = () => [Te, ve, me],
      Ke = () => [Lr, "full", ...U()];
    return {
      cacheSize: 500,
      theme: {
        animate: ["spin", "ping", "pulse", "bounce"],
        aspect: ["video"],
        blur: [nr],
        breakpoint: [nr],
        color: [ab],
        container: [nr],
        "drop-shadow": [nr],
        ease: ["in", "out", "in-out"],
        font: [PT],
        "font-weight": [
          "thin",
          "extralight",
          "light",
          "normal",
          "medium",
          "semibold",
          "bold",
          "extrabold",
          "black",
        ],
        "inset-shadow": [nr],
        leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
        perspective: [
          "dramatic",
          "near",
          "normal",
          "midrange",
          "distant",
          "none",
        ],
        radius: [nr],
        shadow: [nr],
        spacing: ["px", Te],
        text: [nr],
        "text-shadow": [nr],
        tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"],
      },
      classGroups: {
        aspect: [{ aspect: ["auto", "square", Lr, me, ve, R] }],
        container: ["container"],
        columns: [{ columns: [Te, me, ve, h] }],
        "break-after": [{ "break-after": q() }],
        "break-before": [{ "break-before": q() }],
        "break-inside": [
          { "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"] },
        ],
        "box-decoration": [{ "box-decoration": ["slice", "clone"] }],
        box: [{ box: ["border", "content"] }],
        display: [
          "block",
          "inline-block",
          "inline",
          "flex",
          "inline-flex",
          "table",
          "inline-table",
          "table-caption",
          "table-cell",
          "table-column",
          "table-column-group",
          "table-footer-group",
          "table-header-group",
          "table-row-group",
          "table-row",
          "flow-root",
          "grid",
          "inline-grid",
          "contents",
          "list-item",
          "hidden",
        ],
        sr: ["sr-only", "not-sr-only"],
        float: [{ float: ["right", "left", "none", "start", "end"] }],
        clear: [{ clear: ["left", "right", "both", "none", "start", "end"] }],
        isolation: ["isolate", "isolation-auto"],
        "object-fit": [
          { object: ["contain", "cover", "fill", "none", "scale-down"] },
        ],
        "object-position": [{ object: Q() }],
        overflow: [{ overflow: V() }],
        "overflow-x": [{ "overflow-x": V() }],
        "overflow-y": [{ "overflow-y": V() }],
        overscroll: [{ overscroll: N() }],
        "overscroll-x": [{ "overscroll-x": N() }],
        "overscroll-y": [{ "overscroll-y": N() }],
        position: ["static", "fixed", "absolute", "relative", "sticky"],
        inset: [{ inset: W() }],
        "inset-x": [{ "inset-x": W() }],
        "inset-y": [{ "inset-y": W() }],
        start: [{ "inset-s": W(), start: W() }],
        end: [{ "inset-e": W(), end: W() }],
        "inset-bs": [{ "inset-bs": W() }],
        "inset-be": [{ "inset-be": W() }],
        top: [{ top: W() }],
        right: [{ right: W() }],
        bottom: [{ bottom: W() }],
        left: [{ left: W() }],
        visibility: ["visible", "invisible", "collapse"],
        z: [{ z: [Hr, "auto", ve, me] }],
        basis: [{ basis: [Lr, "full", "auto", h, ...U()] }],
        "flex-direction": [
          { flex: ["row", "row-reverse", "col", "col-reverse"] },
        ],
        "flex-wrap": [{ flex: ["nowrap", "wrap", "wrap-reverse"] }],
        flex: [{ flex: [Te, Lr, "auto", "initial", "none", me] }],
        grow: [{ grow: ["", Te, ve, me] }],
        shrink: [{ shrink: ["", Te, ve, me] }],
        order: [{ order: [Hr, "first", "last", "none", ve, me] }],
        "grid-cols": [{ "grid-cols": ne() }],
        "col-start-end": [{ col: ae() }],
        "col-start": [{ "col-start": te() }],
        "col-end": [{ "col-end": te() }],
        "grid-rows": [{ "grid-rows": ne() }],
        "row-start-end": [{ row: ae() }],
        "row-start": [{ "row-start": te() }],
        "row-end": [{ "row-end": te() }],
        "grid-flow": [
          { "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"] },
        ],
        "auto-cols": [{ "auto-cols": oe() }],
        "auto-rows": [{ "auto-rows": oe() }],
        gap: [{ gap: U() }],
        "gap-x": [{ "gap-x": U() }],
        "gap-y": [{ "gap-y": U() }],
        "justify-content": [{ justify: [...se(), "normal"] }],
        "justify-items": [{ "justify-items": [...ce(), "normal"] }],
        "justify-self": [{ "justify-self": ["auto", ...ce()] }],
        "align-content": [{ content: ["normal", ...se()] }],
        "align-items": [{ items: [...ce(), { baseline: ["", "last"] }] }],
        "align-self": [{ self: ["auto", ...ce(), { baseline: ["", "last"] }] }],
        "place-content": [{ "place-content": se() }],
        "place-items": [{ "place-items": [...ce(), "baseline"] }],
        "place-self": [{ "place-self": ["auto", ...ce()] }],
        p: [{ p: U() }],
        px: [{ px: U() }],
        py: [{ py: U() }],
        ps: [{ ps: U() }],
        pe: [{ pe: U() }],
        pbs: [{ pbs: U() }],
        pbe: [{ pbe: U() }],
        pt: [{ pt: U() }],
        pr: [{ pr: U() }],
        pb: [{ pb: U() }],
        pl: [{ pl: U() }],
        m: [{ m: A() }],
        mx: [{ mx: A() }],
        my: [{ my: A() }],
        ms: [{ ms: A() }],
        me: [{ me: A() }],
        mbs: [{ mbs: A() }],
        mbe: [{ mbe: A() }],
        mt: [{ mt: A() }],
        mr: [{ mr: A() }],
        mb: [{ mb: A() }],
        ml: [{ ml: A() }],
        "space-x": [{ "space-x": U() }],
        "space-x-reverse": ["space-x-reverse"],
        "space-y": [{ "space-y": U() }],
        "space-y-reverse": ["space-y-reverse"],
        size: [{ size: B() }],
        "inline-size": [{ inline: ["auto", ...K()] }],
        "min-inline-size": [{ "min-inline": ["auto", ...K()] }],
        "max-inline-size": [{ "max-inline": ["none", ...K()] }],
        "block-size": [{ block: ["auto", ...le()] }],
        "min-block-size": [{ "min-block": ["auto", ...le()] }],
        "max-block-size": [{ "max-block": ["none", ...le()] }],
        w: [{ w: [h, "screen", ...B()] }],
        "min-w": [{ "min-w": [h, "screen", "none", ...B()] }],
        "max-w": [
          { "max-w": [h, "screen", "none", "prose", { screen: [d] }, ...B()] },
        ],
        h: [{ h: ["screen", "lh", ...B()] }],
        "min-h": [{ "min-h": ["screen", "lh", "none", ...B()] }],
        "max-h": [{ "max-h": ["screen", "lh", ...B()] }],
        "font-size": [{ text: ["base", i, Al, ba] }],
        "font-smoothing": ["antialiased", "subpixel-antialiased"],
        "font-style": ["italic", "not-italic"],
        "font-weight": [{ font: [o, IT, QT] }],
        "font-stretch": [
          {
            "font-stretch": [
              "ultra-condensed",
              "extra-condensed",
              "condensed",
              "semi-condensed",
              "normal",
              "semi-expanded",
              "expanded",
              "extra-expanded",
              "ultra-expanded",
              Uf,
              me,
            ],
          },
        ],
        "font-family": [{ font: [GT, VT, a] }],
        "font-features": [{ "font-features": [me] }],
        "fvn-normal": ["normal-nums"],
        "fvn-ordinal": ["ordinal"],
        "fvn-slashed-zero": ["slashed-zero"],
        "fvn-figure": ["lining-nums", "oldstyle-nums"],
        "fvn-spacing": ["proportional-nums", "tabular-nums"],
        "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
        tracking: [{ tracking: [s, ve, me] }],
        "line-clamp": [{ "line-clamp": [Te, "none", ve, qy] }],
        leading: [{ leading: [c, ...U()] }],
        "list-image": [{ "list-image": ["none", ve, me] }],
        "list-style-position": [{ list: ["inside", "outside"] }],
        "list-style-type": [{ list: ["disc", "decimal", "none", ve, me] }],
        "text-alignment": [
          { text: ["left", "center", "right", "justify", "start", "end"] },
        ],
        "placeholder-color": [{ placeholder: J() }],
        "text-color": [{ text: J() }],
        "text-decoration": [
          "underline",
          "overline",
          "line-through",
          "no-underline",
        ],
        "text-decoration-style": [{ decoration: [...re(), "wavy"] }],
        "text-decoration-thickness": [
          { decoration: [Te, "from-font", "auto", ve, ba] },
        ],
        "text-decoration-color": [{ decoration: J() }],
        "underline-offset": [{ "underline-offset": [Te, "auto", ve, me] }],
        "text-transform": [
          "uppercase",
          "lowercase",
          "capitalize",
          "normal-case",
        ],
        "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
        "text-wrap": [{ text: ["wrap", "nowrap", "balance", "pretty"] }],
        indent: [{ indent: U() }],
        "vertical-align": [
          {
            align: [
              "baseline",
              "top",
              "middle",
              "bottom",
              "text-top",
              "text-bottom",
              "sub",
              "super",
              ve,
              me,
            ],
          },
        ],
        whitespace: [
          {
            whitespace: [
              "normal",
              "nowrap",
              "pre",
              "pre-line",
              "pre-wrap",
              "break-spaces",
            ],
          },
        ],
        break: [{ break: ["normal", "words", "all", "keep"] }],
        wrap: [{ wrap: ["break-word", "anywhere", "normal"] }],
        hyphens: [{ hyphens: ["none", "manual", "auto"] }],
        content: [{ content: ["none", ve, me] }],
        "bg-attachment": [{ bg: ["fixed", "local", "scroll"] }],
        "bg-clip": [{ "bg-clip": ["border", "padding", "content", "text"] }],
        "bg-origin": [{ "bg-origin": ["border", "padding", "content"] }],
        "bg-position": [{ bg: T() }],
        "bg-repeat": [{ bg: G() }],
        "bg-size": [{ bg: k() }],
        "bg-image": [
          {
            bg: [
              "none",
              {
                linear: [
                  { to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"] },
                  Hr,
                  ve,
                  me,
                ],
                radial: ["", ve, me],
                conic: [Hr, ve, me],
              },
              XT,
              YT,
            ],
          },
        ],
        "bg-color": [{ bg: J() }],
        "gradient-from-pos": [{ from: I() }],
        "gradient-via-pos": [{ via: I() }],
        "gradient-to-pos": [{ to: I() }],
        "gradient-from": [{ from: J() }],
        "gradient-via": [{ via: J() }],
        "gradient-to": [{ to: J() }],
        rounded: [{ rounded: ee() }],
        "rounded-s": [{ "rounded-s": ee() }],
        "rounded-e": [{ "rounded-e": ee() }],
        "rounded-t": [{ "rounded-t": ee() }],
        "rounded-r": [{ "rounded-r": ee() }],
        "rounded-b": [{ "rounded-b": ee() }],
        "rounded-l": [{ "rounded-l": ee() }],
        "rounded-ss": [{ "rounded-ss": ee() }],
        "rounded-se": [{ "rounded-se": ee() }],
        "rounded-ee": [{ "rounded-ee": ee() }],
        "rounded-es": [{ "rounded-es": ee() }],
        "rounded-tl": [{ "rounded-tl": ee() }],
        "rounded-tr": [{ "rounded-tr": ee() }],
        "rounded-br": [{ "rounded-br": ee() }],
        "rounded-bl": [{ "rounded-bl": ee() }],
        "border-w": [{ border: ue() }],
        "border-w-x": [{ "border-x": ue() }],
        "border-w-y": [{ "border-y": ue() }],
        "border-w-s": [{ "border-s": ue() }],
        "border-w-e": [{ "border-e": ue() }],
        "border-w-bs": [{ "border-bs": ue() }],
        "border-w-be": [{ "border-be": ue() }],
        "border-w-t": [{ "border-t": ue() }],
        "border-w-r": [{ "border-r": ue() }],
        "border-w-b": [{ "border-b": ue() }],
        "border-w-l": [{ "border-l": ue() }],
        "divide-x": [{ "divide-x": ue() }],
        "divide-x-reverse": ["divide-x-reverse"],
        "divide-y": [{ "divide-y": ue() }],
        "divide-y-reverse": ["divide-y-reverse"],
        "border-style": [{ border: [...re(), "hidden", "none"] }],
        "divide-style": [{ divide: [...re(), "hidden", "none"] }],
        "border-color": [{ border: J() }],
        "border-color-x": [{ "border-x": J() }],
        "border-color-y": [{ "border-y": J() }],
        "border-color-s": [{ "border-s": J() }],
        "border-color-e": [{ "border-e": J() }],
        "border-color-bs": [{ "border-bs": J() }],
        "border-color-be": [{ "border-be": J() }],
        "border-color-t": [{ "border-t": J() }],
        "border-color-r": [{ "border-r": J() }],
        "border-color-b": [{ "border-b": J() }],
        "border-color-l": [{ "border-l": J() }],
        "divide-color": [{ divide: J() }],
        "outline-style": [{ outline: [...re(), "none", "hidden"] }],
        "outline-offset": [{ "outline-offset": [Te, ve, me] }],
        "outline-w": [{ outline: ["", Te, Al, ba] }],
        "outline-color": [{ outline: J() }],
        shadow: [{ shadow: ["", "none", g, bs, gs] }],
        "shadow-color": [{ shadow: J() }],
        "inset-shadow": [{ "inset-shadow": ["none", v, bs, gs] }],
        "inset-shadow-color": [{ "inset-shadow": J() }],
        "ring-w": [{ ring: ue() }],
        "ring-w-inset": ["ring-inset"],
        "ring-color": [{ ring: J() }],
        "ring-offset-w": [{ "ring-offset": [Te, ba] }],
        "ring-offset-color": [{ "ring-offset": J() }],
        "inset-ring-w": [{ "inset-ring": ue() }],
        "inset-ring-color": [{ "inset-ring": J() }],
        "text-shadow": [{ "text-shadow": ["none", w, bs, gs] }],
        "text-shadow-color": [{ "text-shadow": J() }],
        opacity: [{ opacity: [Te, ve, me] }],
        "mix-blend": [
          { "mix-blend": [...de(), "plus-darker", "plus-lighter"] },
        ],
        "bg-blend": [{ "bg-blend": de() }],
        "mask-clip": [
          {
            "mask-clip": [
              "border",
              "padding",
              "content",
              "fill",
              "stroke",
              "view",
            ],
          },
          "mask-no-clip",
        ],
        "mask-composite": [
          { mask: ["add", "subtract", "intersect", "exclude"] },
        ],
        "mask-image-linear-pos": [{ "mask-linear": [Te] }],
        "mask-image-linear-from-pos": [{ "mask-linear-from": pe() }],
        "mask-image-linear-to-pos": [{ "mask-linear-to": pe() }],
        "mask-image-linear-from-color": [{ "mask-linear-from": J() }],
        "mask-image-linear-to-color": [{ "mask-linear-to": J() }],
        "mask-image-t-from-pos": [{ "mask-t-from": pe() }],
        "mask-image-t-to-pos": [{ "mask-t-to": pe() }],
        "mask-image-t-from-color": [{ "mask-t-from": J() }],
        "mask-image-t-to-color": [{ "mask-t-to": J() }],
        "mask-image-r-from-pos": [{ "mask-r-from": pe() }],
        "mask-image-r-to-pos": [{ "mask-r-to": pe() }],
        "mask-image-r-from-color": [{ "mask-r-from": J() }],
        "mask-image-r-to-color": [{ "mask-r-to": J() }],
        "mask-image-b-from-pos": [{ "mask-b-from": pe() }],
        "mask-image-b-to-pos": [{ "mask-b-to": pe() }],
        "mask-image-b-from-color": [{ "mask-b-from": J() }],
        "mask-image-b-to-color": [{ "mask-b-to": J() }],
        "mask-image-l-from-pos": [{ "mask-l-from": pe() }],
        "mask-image-l-to-pos": [{ "mask-l-to": pe() }],
        "mask-image-l-from-color": [{ "mask-l-from": J() }],
        "mask-image-l-to-color": [{ "mask-l-to": J() }],
        "mask-image-x-from-pos": [{ "mask-x-from": pe() }],
        "mask-image-x-to-pos": [{ "mask-x-to": pe() }],
        "mask-image-x-from-color": [{ "mask-x-from": J() }],
        "mask-image-x-to-color": [{ "mask-x-to": J() }],
        "mask-image-y-from-pos": [{ "mask-y-from": pe() }],
        "mask-image-y-to-pos": [{ "mask-y-to": pe() }],
        "mask-image-y-from-color": [{ "mask-y-from": J() }],
        "mask-image-y-to-color": [{ "mask-y-to": J() }],
        "mask-image-radial": [{ "mask-radial": [ve, me] }],
        "mask-image-radial-from-pos": [{ "mask-radial-from": pe() }],
        "mask-image-radial-to-pos": [{ "mask-radial-to": pe() }],
        "mask-image-radial-from-color": [{ "mask-radial-from": J() }],
        "mask-image-radial-to-color": [{ "mask-radial-to": J() }],
        "mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
        "mask-image-radial-size": [
          {
            "mask-radial": [
              { closest: ["side", "corner"], farthest: ["side", "corner"] },
            ],
          },
        ],
        "mask-image-radial-pos": [{ "mask-radial-at": Z() }],
        "mask-image-conic-pos": [{ "mask-conic": [Te] }],
        "mask-image-conic-from-pos": [{ "mask-conic-from": pe() }],
        "mask-image-conic-to-pos": [{ "mask-conic-to": pe() }],
        "mask-image-conic-from-color": [{ "mask-conic-from": J() }],
        "mask-image-conic-to-color": [{ "mask-conic-to": J() }],
        "mask-mode": [{ mask: ["alpha", "luminance", "match"] }],
        "mask-origin": [
          {
            "mask-origin": [
              "border",
              "padding",
              "content",
              "fill",
              "stroke",
              "view",
            ],
          },
        ],
        "mask-position": [{ mask: T() }],
        "mask-repeat": [{ mask: G() }],
        "mask-size": [{ mask: k() }],
        "mask-type": [{ "mask-type": ["alpha", "luminance"] }],
        "mask-image": [{ mask: ["none", ve, me] }],
        filter: [{ filter: ["", "none", ve, me] }],
        blur: [{ blur: Oe() }],
        brightness: [{ brightness: [Te, ve, me] }],
        contrast: [{ contrast: [Te, ve, me] }],
        "drop-shadow": [{ "drop-shadow": ["", "none", E, bs, gs] }],
        "drop-shadow-color": [{ "drop-shadow": J() }],
        grayscale: [{ grayscale: ["", Te, ve, me] }],
        "hue-rotate": [{ "hue-rotate": [Te, ve, me] }],
        invert: [{ invert: ["", Te, ve, me] }],
        saturate: [{ saturate: [Te, ve, me] }],
        sepia: [{ sepia: ["", Te, ve, me] }],
        "backdrop-filter": [{ "backdrop-filter": ["", "none", ve, me] }],
        "backdrop-blur": [{ "backdrop-blur": Oe() }],
        "backdrop-brightness": [{ "backdrop-brightness": [Te, ve, me] }],
        "backdrop-contrast": [{ "backdrop-contrast": [Te, ve, me] }],
        "backdrop-grayscale": [{ "backdrop-grayscale": ["", Te, ve, me] }],
        "backdrop-hue-rotate": [{ "backdrop-hue-rotate": [Te, ve, me] }],
        "backdrop-invert": [{ "backdrop-invert": ["", Te, ve, me] }],
        "backdrop-opacity": [{ "backdrop-opacity": [Te, ve, me] }],
        "backdrop-saturate": [{ "backdrop-saturate": [Te, ve, me] }],
        "backdrop-sepia": [{ "backdrop-sepia": ["", Te, ve, me] }],
        "border-collapse": [{ border: ["collapse", "separate"] }],
        "border-spacing": [{ "border-spacing": U() }],
        "border-spacing-x": [{ "border-spacing-x": U() }],
        "border-spacing-y": [{ "border-spacing-y": U() }],
        "table-layout": [{ table: ["auto", "fixed"] }],
        caption: [{ caption: ["top", "bottom"] }],
        transition: [
          {
            transition: [
              "",
              "all",
              "colors",
              "opacity",
              "shadow",
              "transform",
              "none",
              ve,
              me,
            ],
          },
        ],
        "transition-behavior": [{ transition: ["normal", "discrete"] }],
        duration: [{ duration: [Te, "initial", ve, me] }],
        ease: [{ ease: ["linear", "initial", M, ve, me] }],
        delay: [{ delay: [Te, ve, me] }],
        animate: [{ animate: ["none", j, ve, me] }],
        backface: [{ backface: ["hidden", "visible"] }],
        perspective: [{ perspective: [S, ve, me] }],
        "perspective-origin": [{ "perspective-origin": Q() }],
        rotate: [{ rotate: Ce() }],
        "rotate-x": [{ "rotate-x": Ce() }],
        "rotate-y": [{ "rotate-y": Ce() }],
        "rotate-z": [{ "rotate-z": Ce() }],
        scale: [{ scale: Re() }],
        "scale-x": [{ "scale-x": Re() }],
        "scale-y": [{ "scale-y": Re() }],
        "scale-z": [{ "scale-z": Re() }],
        "scale-3d": ["scale-3d"],
        skew: [{ skew: et() }],
        "skew-x": [{ "skew-x": et() }],
        "skew-y": [{ "skew-y": et() }],
        transform: [{ transform: [ve, me, "", "none", "gpu", "cpu"] }],
        "transform-origin": [{ origin: Q() }],
        "transform-style": [{ transform: ["3d", "flat"] }],
        translate: [{ translate: Ke() }],
        "translate-x": [{ "translate-x": Ke() }],
        "translate-y": [{ "translate-y": Ke() }],
        "translate-z": [{ "translate-z": Ke() }],
        "translate-none": ["translate-none"],
        accent: [{ accent: J() }],
        appearance: [{ appearance: ["none", "auto"] }],
        "caret-color": [{ caret: J() }],
        "color-scheme": [
          {
            scheme: [
              "normal",
              "dark",
              "light",
              "light-dark",
              "only-dark",
              "only-light",
            ],
          },
        ],
        cursor: [
          {
            cursor: [
              "auto",
              "default",
              "pointer",
              "wait",
              "text",
              "move",
              "help",
              "not-allowed",
              "none",
              "context-menu",
              "progress",
              "cell",
              "crosshair",
              "vertical-text",
              "alias",
              "copy",
              "no-drop",
              "grab",
              "grabbing",
              "all-scroll",
              "col-resize",
              "row-resize",
              "n-resize",
              "e-resize",
              "s-resize",
              "w-resize",
              "ne-resize",
              "nw-resize",
              "se-resize",
              "sw-resize",
              "ew-resize",
              "ns-resize",
              "nesw-resize",
              "nwse-resize",
              "zoom-in",
              "zoom-out",
              ve,
              me,
            ],
          },
        ],
        "field-sizing": [{ "field-sizing": ["fixed", "content"] }],
        "pointer-events": [{ "pointer-events": ["auto", "none"] }],
        resize: [{ resize: ["none", "", "y", "x"] }],
        "scroll-behavior": [{ scroll: ["auto", "smooth"] }],
        "scroll-m": [{ "scroll-m": U() }],
        "scroll-mx": [{ "scroll-mx": U() }],
        "scroll-my": [{ "scroll-my": U() }],
        "scroll-ms": [{ "scroll-ms": U() }],
        "scroll-me": [{ "scroll-me": U() }],
        "scroll-mbs": [{ "scroll-mbs": U() }],
        "scroll-mbe": [{ "scroll-mbe": U() }],
        "scroll-mt": [{ "scroll-mt": U() }],
        "scroll-mr": [{ "scroll-mr": U() }],
        "scroll-mb": [{ "scroll-mb": U() }],
        "scroll-ml": [{ "scroll-ml": U() }],
        "scroll-p": [{ "scroll-p": U() }],
        "scroll-px": [{ "scroll-px": U() }],
        "scroll-py": [{ "scroll-py": U() }],
        "scroll-ps": [{ "scroll-ps": U() }],
        "scroll-pe": [{ "scroll-pe": U() }],
        "scroll-pbs": [{ "scroll-pbs": U() }],
        "scroll-pbe": [{ "scroll-pbe": U() }],
        "scroll-pt": [{ "scroll-pt": U() }],
        "scroll-pr": [{ "scroll-pr": U() }],
        "scroll-pb": [{ "scroll-pb": U() }],
        "scroll-pl": [{ "scroll-pl": U() }],
        "snap-align": [{ snap: ["start", "end", "center", "align-none"] }],
        "snap-stop": [{ snap: ["normal", "always"] }],
        "snap-type": [{ snap: ["none", "x", "y", "both"] }],
        "snap-strictness": [{ snap: ["mandatory", "proximity"] }],
        touch: [{ touch: ["auto", "none", "manipulation"] }],
        "touch-x": [{ "touch-pan": ["x", "left", "right"] }],
        "touch-y": [{ "touch-pan": ["y", "up", "down"] }],
        "touch-pz": ["touch-pinch-zoom"],
        select: [{ select: ["none", "text", "all", "auto"] }],
        "will-change": [
          {
            "will-change": ["auto", "scroll", "contents", "transform", ve, me],
          },
        ],
        fill: [{ fill: ["none", ...J()] }],
        "stroke-w": [{ stroke: [Te, Al, ba, qy] }],
        stroke: [{ stroke: ["none", ...J()] }],
        "forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }],
      },
      conflictingClassGroups: {
        overflow: ["overflow-x", "overflow-y"],
        overscroll: ["overscroll-x", "overscroll-y"],
        inset: [
          "inset-x",
          "inset-y",
          "inset-bs",
          "inset-be",
          "start",
          "end",
          "top",
          "right",
          "bottom",
          "left",
        ],
        "inset-x": ["right", "left"],
        "inset-y": ["top", "bottom"],
        flex: ["basis", "grow", "shrink"],
        gap: ["gap-x", "gap-y"],
        p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
        px: ["pr", "pl"],
        py: ["pt", "pb"],
        m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
        mx: ["mr", "ml"],
        my: ["mt", "mb"],
        size: ["w", "h"],
        "font-size": ["leading"],
        "fvn-normal": [
          "fvn-ordinal",
          "fvn-slashed-zero",
          "fvn-figure",
          "fvn-spacing",
          "fvn-fraction",
        ],
        "fvn-ordinal": ["fvn-normal"],
        "fvn-slashed-zero": ["fvn-normal"],
        "fvn-figure": ["fvn-normal"],
        "fvn-spacing": ["fvn-normal"],
        "fvn-fraction": ["fvn-normal"],
        "line-clamp": ["display", "overflow"],
        rounded: [
          "rounded-s",
          "rounded-e",
          "rounded-t",
          "rounded-r",
          "rounded-b",
          "rounded-l",
          "rounded-ss",
          "rounded-se",
          "rounded-ee",
          "rounded-es",
          "rounded-tl",
          "rounded-tr",
          "rounded-br",
          "rounded-bl",
        ],
        "rounded-s": ["rounded-ss", "rounded-es"],
        "rounded-e": ["rounded-se", "rounded-ee"],
        "rounded-t": ["rounded-tl", "rounded-tr"],
        "rounded-r": ["rounded-tr", "rounded-br"],
        "rounded-b": ["rounded-br", "rounded-bl"],
        "rounded-l": ["rounded-tl", "rounded-bl"],
        "border-spacing": ["border-spacing-x", "border-spacing-y"],
        "border-w": [
          "border-w-x",
          "border-w-y",
          "border-w-s",
          "border-w-e",
          "border-w-bs",
          "border-w-be",
          "border-w-t",
          "border-w-r",
          "border-w-b",
          "border-w-l",
        ],
        "border-w-x": ["border-w-r", "border-w-l"],
        "border-w-y": ["border-w-t", "border-w-b"],
        "border-color": [
          "border-color-x",
          "border-color-y",
          "border-color-s",
          "border-color-e",
          "border-color-bs",
          "border-color-be",
          "border-color-t",
          "border-color-r",
          "border-color-b",
          "border-color-l",
        ],
        "border-color-x": ["border-color-r", "border-color-l"],
        "border-color-y": ["border-color-t", "border-color-b"],
        translate: ["translate-x", "translate-y", "translate-none"],
        "translate-none": [
          "translate",
          "translate-x",
          "translate-y",
          "translate-z",
        ],
        "scroll-m": [
          "scroll-mx",
          "scroll-my",
          "scroll-ms",
          "scroll-me",
          "scroll-mbs",
          "scroll-mbe",
          "scroll-mt",
          "scroll-mr",
          "scroll-mb",
          "scroll-ml",
        ],
        "scroll-mx": ["scroll-mr", "scroll-ml"],
        "scroll-my": ["scroll-mt", "scroll-mb"],
        "scroll-p": [
          "scroll-px",
          "scroll-py",
          "scroll-ps",
          "scroll-pe",
          "scroll-pbs",
          "scroll-pbe",
          "scroll-pt",
          "scroll-pr",
          "scroll-pb",
          "scroll-pl",
        ],
        "scroll-px": ["scroll-pr", "scroll-pl"],
        "scroll-py": ["scroll-pt", "scroll-pb"],
        touch: ["touch-x", "touch-y", "touch-pz"],
        "touch-x": ["touch"],
        "touch-y": ["touch"],
        "touch-pz": ["touch"],
      },
      conflictingClassGroupModifiers: { "font-size": ["leading"] },
      orderSensitiveModifiers: [
        "*",
        "**",
        "after",
        "backdrop",
        "before",
        "details-content",
        "file",
        "first-letter",
        "first-line",
        "marker",
        "placeholder",
        "selection",
      ],
    };
  },
  $T = RT(FT);
function Ot(...n) {
  return $T($0(n));
}
function JT({ delayDuration: n = 0, ...a }) {
  return O.jsx(sT, { "data-slot": "tooltip-provider", delayDuration: n, ...a });
}
var WT = Symbol.for("react.lazy"),
  Bs = Ql[" use ".trim().toString()];
function e_(n) {
  return typeof n == "object" && n !== null && "then" in n;
}
function db(n) {
  return (
    n != null &&
    typeof n == "object" &&
    "$$typeof" in n &&
    n.$$typeof === WT &&
    "_payload" in n &&
    e_(n._payload)
  );
}
function t_(n) {
  const a = r_(n),
    i = b.forwardRef((o, s) => {
      let { children: c, ...d } = o;
      db(c) && typeof Bs == "function" && (c = Bs(c._payload));
      const h = b.Children.toArray(c),
        m = h.find(i_);
      if (m) {
        const p = m.props.children,
          g = h.map((v) =>
            v === m
              ? b.Children.count(p) > 1
                ? b.Children.only(null)
                : b.isValidElement(p)
                  ? p.props.children
                  : null
              : v,
          );
        return O.jsx(a, {
          ...d,
          ref: s,
          children: b.isValidElement(p) ? b.cloneElement(p, void 0, g) : null,
        });
      }
      return O.jsx(a, { ...d, ref: s, children: c });
    });
  return ((i.displayName = `${n}.Slot`), i);
}
var n_ = t_("Slot");
function r_(n) {
  const a = b.forwardRef((i, o) => {
    let { children: s, ...c } = i;
    if (
      (db(s) && typeof Bs == "function" && (s = Bs(s._payload)),
      b.isValidElement(s))
    ) {
      const d = o_(s),
        h = l_(c, s.props);
      return (
        s.type !== b.Fragment && (h.ref = o ? Xl(o, d) : d),
        b.cloneElement(s, h)
      );
    }
    return b.Children.count(s) > 1 ? b.Children.only(null) : null;
  });
  return ((a.displayName = `${n}.SlotClone`), a);
}
var a_ = Symbol("radix.slottable");
function i_(n) {
  return (
    b.isValidElement(n) &&
    typeof n.type == "function" &&
    "__radixId" in n.type &&
    n.type.__radixId === a_
  );
}
function l_(n, a) {
  const i = { ...a };
  for (const o in a) {
    const s = n[o],
      c = a[o];
    /^on[A-Z]/.test(o)
      ? s && c
        ? (i[o] = (...h) => {
            const m = c(...h);
            return (s(...h), m);
          })
        : s && (i[o] = s)
      : o === "style"
        ? (i[o] = { ...s, ...c })
        : o === "className" && (i[o] = [s, c].filter(Boolean).join(" "));
  }
  return { ...n, ...i };
}
function o_(n) {
  let a = Object.getOwnPropertyDescriptor(n.props, "ref")?.get,
    i = a && "isReactWarning" in a && a.isReactWarning;
  return i
    ? n.ref
    : ((a = Object.getOwnPropertyDescriptor(n, "ref")?.get),
      (i = a && "isReactWarning" in a && a.isReactWarning),
      i ? n.props.ref : n.props.ref || n.ref);
}
const Qy = (n) => (typeof n == "boolean" ? `${n}` : n === 0 ? "0" : n),
  Vy = $0,
  hb = (n, a) => (i) => {
    var o;
    if (a?.variants == null) return Vy(n, i?.class, i?.className);
    const { variants: s, defaultVariants: c } = a,
      d = Object.keys(s).map((p) => {
        const g = i?.[p],
          v = c?.[p];
        if (g === null) return null;
        const w = Qy(g) || Qy(v);
        return s[p][w];
      }),
      h =
        i &&
        Object.entries(i).reduce((p, g) => {
          let [v, w] = g;
          return (w === void 0 || (p[v] = w), p);
        }, {}),
      m =
        a == null || (o = a.compoundVariants) === null || o === void 0
          ? void 0
          : o.reduce((p, g) => {
              let { class: v, className: w, ...E } = g;
              return Object.entries(E).every((C) => {
                let [S, R] = C;
                return Array.isArray(R)
                  ? R.includes({ ...c, ...h }[S])
                  : { ...c, ...h }[S] === R;
              })
                ? [...p, v, w]
                : p;
            }, []);
    return Vy(n, d, m, i?.class, i?.className);
  },
  s_ = hb(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground hover:bg-primary/90",
          destructive:
            "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
          outline:
            "border bg-transparent shadow-xs hover:bg-accent dark:bg-transparent dark:border-input dark:hover:bg-input/50",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost: "hover:bg-accent dark:hover:bg-accent/50",
          link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
          default: "h-9 px-4 py-2 has-[>svg]:px-3",
          sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
          lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
          icon: "size-9",
          "icon-sm": "size-8",
          "icon-lg": "size-10",
        },
      },
      defaultVariants: { variant: "default", size: "default" },
    },
  );
function qs({ className: n, variant: a, size: i, asChild: o = !1, ...s }) {
  const c = o ? n_ : "button";
  return O.jsx(c, {
    "data-slot": "button",
    className: Ot(s_({ variant: a, size: i, className: n })),
    ...s,
  });
}
function mb({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "card",
    className: Ot(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      n,
    ),
    ...a,
  });
}
function u_({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "card-header",
    className: Ot(
      "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
      n,
    ),
    ...a,
  });
}
function c_({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "card-title",
    className: Ot("leading-none font-semibold", n),
    ...a,
  });
}
function f_({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "card-description",
    className: Ot("text-muted-foreground text-sm", n),
    ...a,
  });
}
function pb({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "card-content",
    className: Ot("px-6", n),
    ...a,
  });
}
const d_ = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
  vb = (...n) => n.filter((a, i, o) => !!a && o.indexOf(a) === i).join(" ");
var h_ = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
const m_ = b.forwardRef(
  (
    {
      color: n = "currentColor",
      size: a = 24,
      strokeWidth: i = 2,
      absoluteStrokeWidth: o,
      className: s = "",
      children: c,
      iconNode: d,
      ...h
    },
    m,
  ) =>
    b.createElement(
      "svg",
      {
        ref: m,
        ...h_,
        width: a,
        height: a,
        stroke: n,
        strokeWidth: o ? (Number(i) * 24) / Number(a) : i,
        className: vb("lucide", s),
        ...h,
      },
      [
        ...d.map(([p, g]) => b.createElement(p, g)),
        ...(Array.isArray(c) ? c : [c]),
      ],
    ),
);
const xn = (n, a) => {
  const i = b.forwardRef(({ className: o, ...s }, c) =>
    b.createElement(m_, {
      ref: c,
      iconNode: a,
      className: vb(`lucide-${d_(n)}`, o),
      ...s,
    }),
  );
  return ((i.displayName = `${n}`), i);
};
const p_ = xn("Check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);
const yb = xn("ChevronDown", [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]);
const v_ = xn("ChevronUp", [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]]);
const Gd = xn("CircleAlert", [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }],
]);
const y_ = xn("Download", [
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["polyline", { points: "7 10 12 15 17 10", key: "2ggqvy" }],
  ["line", { x1: "12", x2: "12", y1: "15", y2: "3", key: "1vk2je" }],
]);
const g_ = xn("House", [
  ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", key: "5wwlr5" }],
  [
    "path",
    {
      d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      key: "1d0kgt",
    },
  ],
]);
const gb = xn("LoaderCircle", [
  ["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }],
]);
const b_ = xn("LogOut", [
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }],
  ["polyline", { points: "16 17 21 12 16 7", key: "1gabdz" }],
  ["line", { x1: "21", x2: "9", y1: "12", y2: "12", key: "1uyos4" }],
]);
const x_ = xn("RotateCcw", [
  [
    "path",
    { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" },
  ],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
]);
const S_ = xn("Search", [
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
  ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }],
]);
const w_ = xn("TriangleAlert", [
  [
    "path",
    {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq",
    },
  ],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }],
]);
function E_(n, a) {
  if (n instanceof RegExp) return { keys: !1, pattern: n };
  var i,
    o,
    s,
    c,
    d = [],
    h = "",
    m = n.split("/");
  for (m[0] || m.shift(); (s = m.shift()); )
    ((i = s[0]),
      i === "*"
        ? (d.push(i), (h += s[1] === "?" ? "(?:/(.*))?" : "/(.*)"))
        : i === ":"
          ? ((o = s.indexOf("?", 1)),
            (c = s.indexOf(".", 1)),
            d.push(s.substring(1, ~o ? o : ~c ? c : s.length)),
            (h += ~o && !~c ? "(?:/([^/]+?))?" : "/([^/]+?)"),
            ~c && (h += (~o ? "?" : "") + "\\" + s.substring(c)))
          : (h += "/" + s));
  return {
    keys: d,
    pattern: new RegExp("^" + h + (a ? "(?=$|/)" : "/?$"), "i"),
  };
}
var Lf = { exports: {} },
  Hf = {};
var Yy;
function O_() {
  if (Yy) return Hf;
  Yy = 1;
  var n = Qs();
  function a(v, w) {
    return (v === w && (v !== 0 || 1 / v === 1 / w)) || (v !== v && w !== w);
  }
  var i = typeof Object.is == "function" ? Object.is : a,
    o = n.useState,
    s = n.useEffect,
    c = n.useLayoutEffect,
    d = n.useDebugValue;
  function h(v, w) {
    var E = w(),
      C = o({ inst: { value: E, getSnapshot: w } }),
      S = C[0].inst,
      R = C[1];
    return (
      c(
        function () {
          ((S.value = E), (S.getSnapshot = w), m(S) && R({ inst: S }));
        },
        [v, E, w],
      ),
      s(
        function () {
          return (
            m(S) && R({ inst: S }),
            v(function () {
              m(S) && R({ inst: S });
            })
          );
        },
        [v],
      ),
      d(E),
      E
    );
  }
  function m(v) {
    var w = v.getSnapshot;
    v = v.value;
    try {
      var E = w();
      return !i(v, E);
    } catch {
      return !0;
    }
  }
  function p(v, w) {
    return w();
  }
  var g =
    typeof window > "u" ||
    typeof window.document > "u" ||
    typeof window.document.createElement > "u"
      ? p
      : h;
  return (
    (Hf.useSyncExternalStore =
      n.useSyncExternalStore !== void 0 ? n.useSyncExternalStore : g),
    Hf
  );
}
var Gy;
function C_() {
  return (Gy || ((Gy = 1), (Lf.exports = O_())), Lf.exports);
}
var T_ = C_();
const __ = Ql.useInsertionEffect,
  A_ =
    typeof window < "u" &&
    typeof window.document < "u" &&
    typeof window.document.createElement < "u",
  R_ = A_ ? b.useLayoutEffect : b.useEffect,
  M_ = __ || R_,
  bb = (n) => {
    const a = b.useRef([n, (...i) => a[0](...i)]).current;
    return (
      M_(() => {
        a[0] = n;
      }),
      a[1]
    );
  },
  N_ = "popstate",
  Kd = "pushState",
  Xd = "replaceState",
  D_ = "hashchange",
  Ky = [N_, Kd, Xd, D_],
  j_ = (n) => {
    for (const a of Ky) addEventListener(a, n);
    return () => {
      for (const a of Ky) removeEventListener(a, n);
    };
  },
  xb = (n, a) => T_.useSyncExternalStore(j_, n, a),
  Xy = () => location.search,
  z_ = ({ ssrSearch: n } = {}) => xb(Xy, n != null ? () => n : Xy),
  Iy = () => location.pathname,
  U_ = ({ ssrPath: n } = {}) => xb(Iy, n != null ? () => n : Iy),
  L_ = (n, { replace: a = !1, state: i = null } = {}) =>
    history[a ? Xd : Kd](i, "", n),
  H_ = (n = {}) => [U_(n), L_],
  Zy = Symbol.for("wouter_v3");
if (typeof history < "u" && typeof window[Zy] > "u") {
  for (const n of [Kd, Xd]) {
    const a = history[n];
    history[n] = function () {
      const i = a.apply(this, arguments),
        o = new Event(n);
      return ((o.arguments = arguments), dispatchEvent(o), i);
    };
  }
  Object.defineProperty(window, Zy, { value: !0 });
}
const B_ = (n, a) =>
    a.toLowerCase().indexOf(n.toLowerCase())
      ? "~" + a
      : a.slice(n.length) || "/",
  Sb = (n = "") => (n === "/" ? "" : n),
  q_ = (n, a) => (n[0] === "~" ? n.slice(1) : Sb(a) + n),
  P_ = (n = "", a) => B_(Fy(Sb(n)), Fy(a)),
  Fy = (n) => {
    try {
      return decodeURI(n);
    } catch {
      return n;
    }
  },
  wb = {
    hook: H_,
    searchHook: z_,
    parser: E_,
    base: "",
    ssrPath: void 0,
    ssrSearch: void 0,
    ssrContext: void 0,
    hrefs: (n) => n,
    aroundNav: (n, a, i) => n(a, i),
  },
  Eb = b.createContext(wb),
  Zl = () => b.useContext(Eb),
  Ob = {},
  Cb = b.createContext(Ob),
  k_ = () => b.useContext(Cb),
  ru = (n) => {
    const [a, i] = n.hook(n);
    return [P_(n.base, a), bb((o, s) => n.aroundNav(i, q_(o, n.base), s))];
  },
  Id = () => ru(Zl()),
  Tb = (n, a, i, o) => {
    const { pattern: s, keys: c } =
        a instanceof RegExp ? { keys: !1, pattern: a } : n(a || "*", o),
      d = s.exec(i) || [],
      [h, ...m] = d;
    return h !== void 0
      ? [
          !0,
          (() => {
            const p =
              c !== !1
                ? Object.fromEntries(c.map((v, w) => [v, m[w]]))
                : d.groups;
            let g = { ...m };
            return (p && Object.assign(g, p), g);
          })(),
          ...(o ? [h] : []),
        ]
      : [!1, null];
  },
  Q_ = ({ children: n, ...a }) => {
    const i = Zl(),
      o = a.hook ? wb : i;
    let s = o;
    const [c, d = a.ssrSearch ?? ""] = a.ssrPath?.split("?") ?? [];
    (c && ((a.ssrSearch = d), (a.ssrPath = c)),
      (a.hrefs = a.hrefs ?? a.hook?.hrefs),
      (a.searchHook = a.searchHook ?? a.hook?.searchHook));
    let h = b.useRef({}),
      m = h.current,
      p = m;
    for (let g in o) {
      const v = g === "base" ? o[g] + (a[g] ?? "") : (a[g] ?? o[g]);
      (m === p && v !== p[g] && (h.current = p = { ...p }),
        (p[g] = v),
        (v !== o[g] || v !== s[g]) && (s = p));
    }
    return b.createElement(Eb.Provider, { value: s, children: n });
  },
  $y = ({ children: n, component: a }, i) =>
    a ? b.createElement(a, { params: i }) : typeof n == "function" ? n(i) : n,
  V_ = (n) => {
    let a = b.useRef(Ob);
    const i = a.current;
    return (a.current =
      Object.keys(n).length !== Object.keys(i).length ||
      Object.entries(n).some(([o, s]) => s !== i[o])
        ? n
        : i);
  },
  Rl = ({ path: n, nest: a, match: i, ...o }) => {
    const s = Zl(),
      [c] = ru(s),
      [d, h, m] = i ?? Tb(s.parser, n, c, a),
      p = V_({ ...k_(), ...h });
    if (!d) return null;
    const g = m ? b.createElement(Q_, { base: m }, $y(o, p)) : $y(o, p);
    return b.createElement(Cb.Provider, { value: p, children: g });
  };
b.forwardRef((n, a) => {
  const i = Zl(),
    [o, s] = ru(i),
    {
      to: c = "",
      href: d = c,
      onClick: h,
      asChild: m,
      children: p,
      className: g,
      replace: v,
      state: w,
      transition: E,
      ...C
    } = n,
    S = bb((M) => {
      M.ctrlKey ||
        M.metaKey ||
        M.altKey ||
        M.shiftKey ||
        M.button !== 0 ||
        (h?.(M), M.defaultPrevented || (M.preventDefault(), s(d, n)));
    }),
    R = i.hrefs(d[0] === "~" ? d.slice(1) : i.base + d, i);
  return m && b.isValidElement(p)
    ? b.cloneElement(p, { onClick: S, href: R })
    : b.createElement("a", {
        ...C,
        onClick: S,
        href: R,
        className: g?.call ? g(o === d) : g,
        children: p,
        ref: a,
      });
});
const _b = (n) =>
    Array.isArray(n)
      ? n.flatMap((a) => _b(a && a.type === b.Fragment ? a.props.children : a))
      : [n],
  Y_ = ({ children: n, location: a }) => {
    const i = Zl(),
      [o] = ru(i);
    for (const s of _b(n)) {
      let c = 0;
      if (
        b.isValidElement(s) &&
        (c = Tb(i.parser, s.props.path, a || o, s.props.nest))[0]
      )
        return b.cloneElement(s, { match: c });
    }
    return null;
  };
function Jy() {
  const [, n] = Id(),
    a = () => {
      n("/");
    };
  return O.jsx("div", {
    className:
      "min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100",
    children: O.jsx(mb, {
      className:
        "w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm",
      children: O.jsxs(pb, {
        className: "pt-8 pb-8 text-center",
        children: [
          O.jsx("div", {
            className: "flex justify-center mb-6",
            children: O.jsxs("div", {
              className: "relative",
              children: [
                O.jsx("div", {
                  className:
                    "absolute inset-0 bg-red-100 rounded-full animate-pulse",
                }),
                O.jsx(Gd, { className: "relative h-16 w-16 text-red-500" }),
              ],
            }),
          }),
          O.jsx("h1", {
            className: "text-4xl font-bold text-slate-900 mb-2",
            children: "404",
          }),
          O.jsx("h2", {
            className: "text-xl font-semibold text-slate-700 mb-4",
            children: "Page Not Found",
          }),
          O.jsxs("p", {
            className: "text-slate-600 mb-8 leading-relaxed",
            children: [
              "Sorry, the page you are looking for doesn't exist.",
              O.jsx("br", {}),
              "It may have been moved or deleted.",
            ],
          }),
          O.jsx("div", {
            id: "not-found-button-group",
            className: "flex flex-col sm:flex-row gap-3 justify-center",
            children: O.jsxs(qs, {
              onClick: a,
              className:
                "bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg",
              children: [O.jsx(g_, { className: "w-4 h-4 mr-2" }), "Go Home"],
            }),
          }),
        ],
      }),
    }),
  });
}
class G_ extends b.Component {
  constructor(a) {
    (super(a), (this.state = { hasError: !1, error: null }));
  }
  static getDerivedStateFromError(a) {
    return { hasError: !0, error: a };
  }
  render() {
    return this.state.hasError
      ? O.jsx("div", {
          className:
            "flex items-center justify-center min-h-screen p-8 bg-background",
          children: O.jsxs("div", {
            className: "flex flex-col items-center w-full max-w-2xl p-8",
            children: [
              O.jsx(w_, {
                size: 48,
                className: "text-destructive mb-6 flex-shrink-0",
              }),
              O.jsx("h2", {
                className: "text-xl mb-4",
                children: "An unexpected error occurred.",
              }),
              O.jsx("div", {
                className: "p-4 w-full rounded bg-muted overflow-auto mb-6",
                children: O.jsx("pre", {
                  className:
                    "text-sm text-muted-foreground whitespace-break-spaces",
                  children: this.state.error?.stack,
                }),
              }),
              O.jsxs("button", {
                onClick: () => window.location.reload(),
                className: Ot(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer",
                ),
                children: [O.jsx(x_, { size: 16 }), "Reload Page"],
              }),
            ],
          }),
        })
      : this.props.children;
  }
}
const K_ = b.createContext(void 0);
function X_({ children: n, defaultTheme: a = "light", switchable: i = !1 }) {
  const [o, s] = b.useState(() => (i && localStorage.getItem("theme")) || a);
  b.useEffect(() => {
    const d = document.documentElement;
    (o === "dark" ? d.classList.add("dark") : d.classList.remove("dark"),
      i && localStorage.setItem("theme", o));
  }, [o, i]);
  const c = i
    ? () => {
        s((d) => (d === "light" ? "dark" : "light"));
      }
    : void 0;
  return O.jsx(K_.Provider, {
    value: { theme: o, toggleTheme: c, switchable: i },
    children: n,
  });
}
var Bf = "focusScope.autoFocusOnMount",
  qf = "focusScope.autoFocusOnUnmount",
  Wy = { bubbles: !1, cancelable: !0 },
  I_ = "FocusScope",
  Ab = b.forwardRef((n, a) => {
    const {
        loop: i = !1,
        trapped: o = !1,
        onMountAutoFocus: s,
        onUnmountAutoFocus: c,
        ...d
      } = n,
      [h, m] = b.useState(null),
      p = Ea(s),
      g = Ea(c),
      v = b.useRef(null),
      w = st(a, (S) => m(S)),
      E = b.useRef({
        paused: !1,
        pause() {
          this.paused = !0;
        },
        resume() {
          this.paused = !1;
        },
      }).current;
    (b.useEffect(() => {
      if (o) {
        let S = function (q) {
            if (E.paused || !h) return;
            const Z = q.target;
            h.contains(Z) ? (v.current = Z) : qr(v.current, { select: !0 });
          },
          R = function (q) {
            if (E.paused || !h) return;
            const Z = q.relatedTarget;
            Z !== null && (h.contains(Z) || qr(v.current, { select: !0 }));
          },
          M = function (q) {
            if (document.activeElement === document.body)
              for (const Q of q) Q.removedNodes.length > 0 && qr(h);
          };
        (document.addEventListener("focusin", S),
          document.addEventListener("focusout", R));
        const j = new MutationObserver(M);
        return (
          h && j.observe(h, { childList: !0, subtree: !0 }),
          () => {
            (document.removeEventListener("focusin", S),
              document.removeEventListener("focusout", R),
              j.disconnect());
          }
        );
      }
    }, [o, h, E.paused]),
      b.useEffect(() => {
        if (h) {
          tg.add(E);
          const S = document.activeElement;
          if (!h.contains(S)) {
            const M = new CustomEvent(Bf, Wy);
            (h.addEventListener(Bf, p),
              h.dispatchEvent(M),
              M.defaultPrevented ||
                (Z_(eA(Rb(h)), { select: !0 }),
                document.activeElement === S && qr(h)));
          }
          return () => {
            (h.removeEventListener(Bf, p),
              setTimeout(() => {
                const M = new CustomEvent(qf, Wy);
                (h.addEventListener(qf, g),
                  h.dispatchEvent(M),
                  M.defaultPrevented || qr(S ?? document.body, { select: !0 }),
                  h.removeEventListener(qf, g),
                  tg.remove(E));
              }, 0));
          };
        }
      }, [h, p, g, E]));
    const C = b.useCallback(
      (S) => {
        if ((!i && !o) || E.paused) return;
        const R = S.key === "Tab" && !S.altKey && !S.ctrlKey && !S.metaKey,
          M = document.activeElement;
        if (R && M) {
          const j = S.currentTarget,
            [q, Z] = F_(j);
          q && Z
            ? !S.shiftKey && M === Z
              ? (S.preventDefault(), i && qr(q, { select: !0 }))
              : S.shiftKey &&
                M === q &&
                (S.preventDefault(), i && qr(Z, { select: !0 }))
            : M === j && S.preventDefault();
        }
      },
      [i, o, E.paused],
    );
    return O.jsx(We.div, { tabIndex: -1, ...d, ref: w, onKeyDown: C });
  });
Ab.displayName = I_;
function Z_(n, { select: a = !1 } = {}) {
  const i = document.activeElement;
  for (const o of n)
    if ((qr(o, { select: a }), document.activeElement !== i)) return;
}
function F_(n) {
  const a = Rb(n),
    i = eg(a, n),
    o = eg(a.reverse(), n);
  return [i, o];
}
function Rb(n) {
  const a = [],
    i = document.createTreeWalker(n, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (o) => {
        const s = o.tagName === "INPUT" && o.type === "hidden";
        return o.disabled || o.hidden || s
          ? NodeFilter.FILTER_SKIP
          : o.tabIndex >= 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
      },
    });
  for (; i.nextNode(); ) a.push(i.currentNode);
  return a;
}
function eg(n, a) {
  for (const i of n) if (!$_(i, { upTo: a })) return i;
}
function $_(n, { upTo: a }) {
  if (getComputedStyle(n).visibility === "hidden") return !0;
  for (; n; ) {
    if (a !== void 0 && n === a) return !1;
    if (getComputedStyle(n).display === "none") return !0;
    n = n.parentElement;
  }
  return !1;
}
function J_(n) {
  return n instanceof HTMLInputElement && "select" in n;
}
function qr(n, { select: a = !1 } = {}) {
  if (n && n.focus) {
    const i = document.activeElement;
    (n.focus({ preventScroll: !0 }), n !== i && J_(n) && a && n.select());
  }
}
var tg = W_();
function W_() {
  let n = [];
  return {
    add(a) {
      const i = n[0];
      (a !== i && i?.pause(), (n = ng(n, a)), n.unshift(a));
    },
    remove(a) {
      ((n = ng(n, a)), n[0]?.resume());
    },
  };
}
function ng(n, a) {
  const i = [...n],
    o = i.indexOf(a);
  return (o !== -1 && i.splice(o, 1), i);
}
function eA(n) {
  return n.filter((a) => a.tagName !== "A");
}
var Pf = 0;
function tA() {
  b.useEffect(() => {
    const n = document.querySelectorAll("[data-radix-focus-guard]");
    return (
      document.body.insertAdjacentElement("afterbegin", n[0] ?? rg()),
      document.body.insertAdjacentElement("beforeend", n[1] ?? rg()),
      Pf++,
      () => {
        (Pf === 1 &&
          document
            .querySelectorAll("[data-radix-focus-guard]")
            .forEach((a) => a.remove()),
          Pf--);
      }
    );
  }, []);
}
function rg() {
  const n = document.createElement("span");
  return (
    n.setAttribute("data-radix-focus-guard", ""),
    (n.tabIndex = 0),
    (n.style.outline = "none"),
    (n.style.opacity = "0"),
    (n.style.position = "fixed"),
    (n.style.pointerEvents = "none"),
    n
  );
}
var Nn = function () {
  return (
    (Nn =
      Object.assign ||
      function (a) {
        for (var i, o = 1, s = arguments.length; o < s; o++) {
          i = arguments[o];
          for (var c in i)
            Object.prototype.hasOwnProperty.call(i, c) && (a[c] = i[c]);
        }
        return a;
      }),
    Nn.apply(this, arguments)
  );
};
function Mb(n, a) {
  var i = {};
  for (var o in n)
    Object.prototype.hasOwnProperty.call(n, o) &&
      a.indexOf(o) < 0 &&
      (i[o] = n[o]);
  if (n != null && typeof Object.getOwnPropertySymbols == "function")
    for (var s = 0, o = Object.getOwnPropertySymbols(n); s < o.length; s++)
      a.indexOf(o[s]) < 0 &&
        Object.prototype.propertyIsEnumerable.call(n, o[s]) &&
        (i[o[s]] = n[o[s]]);
  return i;
}
function nA(n, a, i) {
  if (i || arguments.length === 2)
    for (var o = 0, s = a.length, c; o < s; o++)
      (c || !(o in a)) &&
        (c || (c = Array.prototype.slice.call(a, 0, o)), (c[o] = a[o]));
  return n.concat(c || Array.prototype.slice.call(a));
}
var Rs = "right-scroll-bar-position",
  Ms = "width-before-scroll-bar",
  rA = "with-scroll-bars-hidden",
  aA = "--removed-body-scroll-bar-size";
function kf(n, a) {
  return (typeof n == "function" ? n(a) : n && (n.current = a), n);
}
function iA(n, a) {
  var i = b.useState(function () {
    return {
      value: n,
      callback: a,
      facade: {
        get current() {
          return i.value;
        },
        set current(o) {
          var s = i.value;
          s !== o && ((i.value = o), i.callback(o, s));
        },
      },
    };
  })[0];
  return ((i.callback = a), i.facade);
}
var lA = typeof window < "u" ? b.useLayoutEffect : b.useEffect,
  ag = new WeakMap();
function oA(n, a) {
  var i = iA(null, function (o) {
    return n.forEach(function (s) {
      return kf(s, o);
    });
  });
  return (
    lA(
      function () {
        var o = ag.get(i);
        if (o) {
          var s = new Set(o),
            c = new Set(n),
            d = i.current;
          (s.forEach(function (h) {
            c.has(h) || kf(h, null);
          }),
            c.forEach(function (h) {
              s.has(h) || kf(h, d);
            }));
        }
        ag.set(i, n);
      },
      [n],
    ),
    i
  );
}
function sA(n) {
  return n;
}
function uA(n, a) {
  a === void 0 && (a = sA);
  var i = [],
    o = !1,
    s = {
      read: function () {
        if (o)
          throw new Error(
            "Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.",
          );
        return i.length ? i[i.length - 1] : n;
      },
      useMedium: function (c) {
        var d = a(c, o);
        return (
          i.push(d),
          function () {
            i = i.filter(function (h) {
              return h !== d;
            });
          }
        );
      },
      assignSyncMedium: function (c) {
        for (o = !0; i.length; ) {
          var d = i;
          ((i = []), d.forEach(c));
        }
        i = {
          push: function (h) {
            return c(h);
          },
          filter: function () {
            return i;
          },
        };
      },
      assignMedium: function (c) {
        o = !0;
        var d = [];
        if (i.length) {
          var h = i;
          ((i = []), h.forEach(c), (d = i));
        }
        var m = function () {
            var g = d;
            ((d = []), g.forEach(c));
          },
          p = function () {
            return Promise.resolve().then(m);
          };
        (p(),
          (i = {
            push: function (g) {
              (d.push(g), p());
            },
            filter: function (g) {
              return ((d = d.filter(g)), i);
            },
          }));
      },
    };
  return s;
}
function cA(n) {
  n === void 0 && (n = {});
  var a = uA(null);
  return ((a.options = Nn({ async: !0, ssr: !1 }, n)), a);
}
var Nb = function (n) {
  var a = n.sideCar,
    i = Mb(n, ["sideCar"]);
  if (!a)
    throw new Error(
      "Sidecar: please provide `sideCar` property to import the right car",
    );
  var o = a.read();
  if (!o) throw new Error("Sidecar medium not found");
  return b.createElement(o, Nn({}, i));
};
Nb.isSideCarExport = !0;
function fA(n, a) {
  return (n.useMedium(a), Nb);
}
var Db = cA(),
  Qf = function () {},
  au = b.forwardRef(function (n, a) {
    var i = b.useRef(null),
      o = b.useState({
        onScrollCapture: Qf,
        onWheelCapture: Qf,
        onTouchMoveCapture: Qf,
      }),
      s = o[0],
      c = o[1],
      d = n.forwardProps,
      h = n.children,
      m = n.className,
      p = n.removeScrollBar,
      g = n.enabled,
      v = n.shards,
      w = n.sideCar,
      E = n.noRelative,
      C = n.noIsolation,
      S = n.inert,
      R = n.allowPinchZoom,
      M = n.as,
      j = M === void 0 ? "div" : M,
      q = n.gapMode,
      Z = Mb(n, [
        "forwardProps",
        "children",
        "className",
        "removeScrollBar",
        "enabled",
        "shards",
        "sideCar",
        "noRelative",
        "noIsolation",
        "inert",
        "allowPinchZoom",
        "as",
        "gapMode",
      ]),
      Q = w,
      V = oA([i, a]),
      N = Nn(Nn({}, Z), s);
    return b.createElement(
      b.Fragment,
      null,
      g &&
        b.createElement(Q, {
          sideCar: Db,
          removeScrollBar: p,
          shards: v,
          noRelative: E,
          noIsolation: C,
          inert: S,
          setCallbacks: c,
          allowPinchZoom: !!R,
          lockRef: i,
          gapMode: q,
        }),
      d
        ? b.cloneElement(b.Children.only(h), Nn(Nn({}, N), { ref: V }))
        : b.createElement(j, Nn({}, N, { className: m, ref: V }), h),
    );
  });
au.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 };
au.classNames = { fullWidth: Ms, zeroRight: Rs };
var dA = function () {
  if (typeof __webpack_nonce__ < "u") return __webpack_nonce__;
};
function hA() {
  if (!document) return null;
  var n = document.createElement("style");
  n.type = "text/css";
  var a = dA();
  return (a && n.setAttribute("nonce", a), n);
}
function mA(n, a) {
  n.styleSheet
    ? (n.styleSheet.cssText = a)
    : n.appendChild(document.createTextNode(a));
}
function pA(n) {
  var a = document.head || document.getElementsByTagName("head")[0];
  a.appendChild(n);
}
var vA = function () {
    var n = 0,
      a = null;
    return {
      add: function (i) {
        (n == 0 && (a = hA()) && (mA(a, i), pA(a)), n++);
      },
      remove: function () {
        (n--,
          !n && a && (a.parentNode && a.parentNode.removeChild(a), (a = null)));
      },
    };
  },
  yA = function () {
    var n = vA();
    return function (a, i) {
      b.useEffect(
        function () {
          return (
            n.add(a),
            function () {
              n.remove();
            }
          );
        },
        [a && i],
      );
    };
  },
  jb = function () {
    var n = yA(),
      a = function (i) {
        var o = i.styles,
          s = i.dynamic;
        return (n(o, s), null);
      };
    return a;
  },
  gA = { left: 0, top: 0, right: 0, gap: 0 },
  Vf = function (n) {
    return parseInt(n || "", 10) || 0;
  },
  bA = function (n) {
    var a = window.getComputedStyle(document.body),
      i = a[n === "padding" ? "paddingLeft" : "marginLeft"],
      o = a[n === "padding" ? "paddingTop" : "marginTop"],
      s = a[n === "padding" ? "paddingRight" : "marginRight"];
    return [Vf(i), Vf(o), Vf(s)];
  },
  xA = function (n) {
    if ((n === void 0 && (n = "margin"), typeof window > "u")) return gA;
    var a = bA(n),
      i = document.documentElement.clientWidth,
      o = window.innerWidth;
    return {
      left: a[0],
      top: a[1],
      right: a[2],
      gap: Math.max(0, o - i + a[2] - a[0]),
    };
  },
  SA = jb(),
  Oi = "data-scroll-locked",
  wA = function (n, a, i, o) {
    var s = n.left,
      c = n.top,
      d = n.right,
      h = n.gap;
    return (
      i === void 0 && (i = "margin"),
      `
  .`
        .concat(
          rA,
          ` {
   overflow: hidden `,
        )
        .concat(
          o,
          `;
   padding-right: `,
        )
        .concat(h, "px ")
        .concat(
          o,
          `;
  }
  body[`,
        )
        .concat(
          Oi,
          `] {
    overflow: hidden `,
        )
        .concat(
          o,
          `;
    overscroll-behavior: contain;
    `,
        )
        .concat(
          [
            a && "position: relative ".concat(o, ";"),
            i === "margin" &&
              `
    padding-left: `
                .concat(
                  s,
                  `px;
    padding-top: `,
                )
                .concat(
                  c,
                  `px;
    padding-right: `,
                )
                .concat(
                  d,
                  `px;
    margin-left:0;
    margin-top:0;
    margin-right: `,
                )
                .concat(h, "px ")
                .concat(
                  o,
                  `;
    `,
                ),
            i === "padding" &&
              "padding-right: ".concat(h, "px ").concat(o, ";"),
          ]
            .filter(Boolean)
            .join(""),
          `
  }
  
  .`,
        )
        .concat(
          Rs,
          ` {
    right: `,
        )
        .concat(h, "px ")
        .concat(
          o,
          `;
  }
  
  .`,
        )
        .concat(
          Ms,
          ` {
    margin-right: `,
        )
        .concat(h, "px ")
        .concat(
          o,
          `;
  }
  
  .`,
        )
        .concat(Rs, " .")
        .concat(
          Rs,
          ` {
    right: 0 `,
        )
        .concat(
          o,
          `;
  }
  
  .`,
        )
        .concat(Ms, " .")
        .concat(
          Ms,
          ` {
    margin-right: 0 `,
        )
        .concat(
          o,
          `;
  }
  
  body[`,
        )
        .concat(
          Oi,
          `] {
    `,
        )
        .concat(aA, ": ")
        .concat(
          h,
          `px;
  }
`,
        )
    );
  },
  ig = function () {
    var n = parseInt(document.body.getAttribute(Oi) || "0", 10);
    return isFinite(n) ? n : 0;
  },
  EA = function () {
    b.useEffect(function () {
      return (
        document.body.setAttribute(Oi, (ig() + 1).toString()),
        function () {
          var n = ig() - 1;
          n <= 0
            ? document.body.removeAttribute(Oi)
            : document.body.setAttribute(Oi, n.toString());
        }
      );
    }, []);
  },
  OA = function (n) {
    var a = n.noRelative,
      i = n.noImportant,
      o = n.gapMode,
      s = o === void 0 ? "margin" : o;
    EA();
    var c = b.useMemo(
      function () {
        return xA(s);
      },
      [s],
    );
    return b.createElement(SA, { styles: wA(c, !a, s, i ? "" : "!important") });
  },
  vd = !1;
if (typeof window < "u")
  try {
    var xs = Object.defineProperty({}, "passive", {
      get: function () {
        return ((vd = !0), !0);
      },
    });
    (window.addEventListener("test", xs, xs),
      window.removeEventListener("test", xs, xs));
  } catch {
    vd = !1;
  }
var bi = vd ? { passive: !1 } : !1,
  CA = function (n) {
    return n.tagName === "TEXTAREA";
  },
  zb = function (n, a) {
    if (!(n instanceof Element)) return !1;
    var i = window.getComputedStyle(n);
    return (
      i[a] !== "hidden" &&
      !(i.overflowY === i.overflowX && !CA(n) && i[a] === "visible")
    );
  },
  TA = function (n) {
    return zb(n, "overflowY");
  },
  _A = function (n) {
    return zb(n, "overflowX");
  },
  lg = function (n, a) {
    var i = a.ownerDocument,
      o = a;
    do {
      typeof ShadowRoot < "u" && o instanceof ShadowRoot && (o = o.host);
      var s = Ub(n, o);
      if (s) {
        var c = Lb(n, o),
          d = c[1],
          h = c[2];
        if (d > h) return !0;
      }
      o = o.parentNode;
    } while (o && o !== i.body);
    return !1;
  },
  AA = function (n) {
    var a = n.scrollTop,
      i = n.scrollHeight,
      o = n.clientHeight;
    return [a, i, o];
  },
  RA = function (n) {
    var a = n.scrollLeft,
      i = n.scrollWidth,
      o = n.clientWidth;
    return [a, i, o];
  },
  Ub = function (n, a) {
    return n === "v" ? TA(a) : _A(a);
  },
  Lb = function (n, a) {
    return n === "v" ? AA(a) : RA(a);
  },
  MA = function (n, a) {
    return n === "h" && a === "rtl" ? -1 : 1;
  },
  NA = function (n, a, i, o, s) {
    var c = MA(n, window.getComputedStyle(a).direction),
      d = c * o,
      h = i.target,
      m = a.contains(h),
      p = !1,
      g = d > 0,
      v = 0,
      w = 0;
    do {
      if (!h) break;
      var E = Lb(n, h),
        C = E[0],
        S = E[1],
        R = E[2],
        M = S - R - c * C;
      (C || M) && Ub(n, h) && ((v += M), (w += C));
      var j = h.parentNode;
      h = j && j.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? j.host : j;
    } while ((!m && h !== document.body) || (m && (a.contains(h) || a === h)));
    return (((g && Math.abs(v) < 1) || (!g && Math.abs(w) < 1)) && (p = !0), p);
  },
  Ss = function (n) {
    return "changedTouches" in n
      ? [n.changedTouches[0].clientX, n.changedTouches[0].clientY]
      : [0, 0];
  },
  og = function (n) {
    return [n.deltaX, n.deltaY];
  },
  sg = function (n) {
    return n && "current" in n ? n.current : n;
  },
  DA = function (n, a) {
    return n[0] === a[0] && n[1] === a[1];
  },
  jA = function (n) {
    return `
  .block-interactivity-`
      .concat(
        n,
        ` {pointer-events: none;}
  .allow-interactivity-`,
      )
      .concat(
        n,
        ` {pointer-events: all;}
`,
      );
  },
  zA = 0,
  xi = [];
function UA(n) {
  var a = b.useRef([]),
    i = b.useRef([0, 0]),
    o = b.useRef(),
    s = b.useState(zA++)[0],
    c = b.useState(jb)[0],
    d = b.useRef(n);
  (b.useEffect(
    function () {
      d.current = n;
    },
    [n],
  ),
    b.useEffect(
      function () {
        if (n.inert) {
          document.body.classList.add("block-interactivity-".concat(s));
          var S = nA([n.lockRef.current], (n.shards || []).map(sg), !0).filter(
            Boolean,
          );
          return (
            S.forEach(function (R) {
              return R.classList.add("allow-interactivity-".concat(s));
            }),
            function () {
              (document.body.classList.remove("block-interactivity-".concat(s)),
                S.forEach(function (R) {
                  return R.classList.remove("allow-interactivity-".concat(s));
                }));
            }
          );
        }
      },
      [n.inert, n.lockRef.current, n.shards],
    ));
  var h = b.useCallback(function (S, R) {
      if (
        ("touches" in S && S.touches.length === 2) ||
        (S.type === "wheel" && S.ctrlKey)
      )
        return !d.current.allowPinchZoom;
      var M = Ss(S),
        j = i.current,
        q = "deltaX" in S ? S.deltaX : j[0] - M[0],
        Z = "deltaY" in S ? S.deltaY : j[1] - M[1],
        Q,
        V = S.target,
        N = Math.abs(q) > Math.abs(Z) ? "h" : "v";
      if ("touches" in S && N === "h" && V.type === "range") return !1;
      var U = window.getSelection(),
        W = U && U.anchorNode,
        ne = W ? W === V || W.contains(V) : !1;
      if (ne) return !1;
      var ae = lg(N, V);
      if (!ae) return !0;
      if ((ae ? (Q = N) : ((Q = N === "v" ? "h" : "v"), (ae = lg(N, V))), !ae))
        return !1;
      if (
        (!o.current && "changedTouches" in S && (q || Z) && (o.current = Q), !Q)
      )
        return !0;
      var te = o.current || Q;
      return NA(te, R, S, te === "h" ? q : Z);
    }, []),
    m = b.useCallback(function (S) {
      var R = S;
      if (!(!xi.length || xi[xi.length - 1] !== c)) {
        var M = "deltaY" in R ? og(R) : Ss(R),
          j = a.current.filter(function (Q) {
            return (
              Q.name === R.type &&
              (Q.target === R.target || R.target === Q.shadowParent) &&
              DA(Q.delta, M)
            );
          })[0];
        if (j && j.should) {
          R.cancelable && R.preventDefault();
          return;
        }
        if (!j) {
          var q = (d.current.shards || [])
              .map(sg)
              .filter(Boolean)
              .filter(function (Q) {
                return Q.contains(R.target);
              }),
            Z = q.length > 0 ? h(R, q[0]) : !d.current.noIsolation;
          Z && R.cancelable && R.preventDefault();
        }
      }
    }, []),
    p = b.useCallback(function (S, R, M, j) {
      var q = { name: S, delta: R, target: M, should: j, shadowParent: LA(M) };
      (a.current.push(q),
        setTimeout(function () {
          a.current = a.current.filter(function (Z) {
            return Z !== q;
          });
        }, 1));
    }, []),
    g = b.useCallback(function (S) {
      ((i.current = Ss(S)), (o.current = void 0));
    }, []),
    v = b.useCallback(function (S) {
      p(S.type, og(S), S.target, h(S, n.lockRef.current));
    }, []),
    w = b.useCallback(function (S) {
      p(S.type, Ss(S), S.target, h(S, n.lockRef.current));
    }, []);
  b.useEffect(function () {
    return (
      xi.push(c),
      n.setCallbacks({
        onScrollCapture: v,
        onWheelCapture: v,
        onTouchMoveCapture: w,
      }),
      document.addEventListener("wheel", m, bi),
      document.addEventListener("touchmove", m, bi),
      document.addEventListener("touchstart", g, bi),
      function () {
        ((xi = xi.filter(function (S) {
          return S !== c;
        })),
          document.removeEventListener("wheel", m, bi),
          document.removeEventListener("touchmove", m, bi),
          document.removeEventListener("touchstart", g, bi));
      }
    );
  }, []);
  var E = n.removeScrollBar,
    C = n.inert;
  return b.createElement(
    b.Fragment,
    null,
    C ? b.createElement(c, { styles: jA(s) }) : null,
    E
      ? b.createElement(OA, { noRelative: n.noRelative, gapMode: n.gapMode })
      : null,
  );
}
function LA(n) {
  for (var a = null; n !== null; )
    (n instanceof ShadowRoot && ((a = n.host), (n = n.host)),
      (n = n.parentNode));
  return a;
}
const HA = fA(Db, UA);
var Hb = b.forwardRef(function (n, a) {
  return b.createElement(au, Nn({}, n, { ref: a, sideCar: HA }));
});
Hb.classNames = au.classNames;
var BA = function (n) {
    if (typeof document > "u") return null;
    var a = Array.isArray(n) ? n[0] : n;
    return a.ownerDocument.body;
  },
  Si = new WeakMap(),
  ws = new WeakMap(),
  Es = {},
  Yf = 0,
  Bb = function (n) {
    return n && (n.host || Bb(n.parentNode));
  },
  qA = function (n, a) {
    return a
      .map(function (i) {
        if (n.contains(i)) return i;
        var o = Bb(i);
        return o && n.contains(o)
          ? o
          : (console.error(
              "aria-hidden",
              i,
              "in not contained inside",
              n,
              ". Doing nothing",
            ),
            null);
      })
      .filter(function (i) {
        return !!i;
      });
  },
  PA = function (n, a, i, o) {
    var s = qA(a, Array.isArray(n) ? n : [n]);
    Es[i] || (Es[i] = new WeakMap());
    var c = Es[i],
      d = [],
      h = new Set(),
      m = new Set(s),
      p = function (v) {
        !v || h.has(v) || (h.add(v), p(v.parentNode));
      };
    s.forEach(p);
    var g = function (v) {
      !v ||
        m.has(v) ||
        Array.prototype.forEach.call(v.children, function (w) {
          if (h.has(w)) g(w);
          else
            try {
              var E = w.getAttribute(o),
                C = E !== null && E !== "false",
                S = (Si.get(w) || 0) + 1,
                R = (c.get(w) || 0) + 1;
              (Si.set(w, S),
                c.set(w, R),
                d.push(w),
                S === 1 && C && ws.set(w, !0),
                R === 1 && w.setAttribute(i, "true"),
                C || w.setAttribute(o, "true"));
            } catch (M) {
              console.error("aria-hidden: cannot operate on ", w, M);
            }
        });
    };
    return (
      g(a),
      h.clear(),
      Yf++,
      function () {
        (d.forEach(function (v) {
          var w = Si.get(v) - 1,
            E = c.get(v) - 1;
          (Si.set(v, w),
            c.set(v, E),
            w || (ws.has(v) || v.removeAttribute(o), ws.delete(v)),
            E || v.removeAttribute(i));
        }),
          Yf--,
          Yf ||
            ((Si = new WeakMap()),
            (Si = new WeakMap()),
            (ws = new WeakMap()),
            (Es = {})));
      }
    );
  },
  kA = function (n, a, i) {
    i === void 0 && (i = "data-aria-hidden");
    var o = Array.from(Array.isArray(n) ? n : [n]),
      s = BA(n);
    return s
      ? (o.push.apply(o, Array.from(s.querySelectorAll("[aria-live], script"))),
        PA(o, s, i, "aria-hidden"))
      : function () {
          return null;
        };
  };
const QA = b.createContext({
    isComposing: () => !1,
    setComposing: () => {},
    justEndedComposing: () => !1,
    markCompositionEnd: () => {},
  }),
  VA = () => b.useContext(QA);
function Os(n) {
  const a = b.useRef(n);
  a.current = n;
  const i = b.useRef(null);
  return (
    i.current ||
      (i.current = function (...o) {
        return a.current.apply(this, o);
      }),
    i.current
  );
}
function YA(n = {}) {
  const { onKeyDown: a, onCompositionStart: i, onCompositionEnd: o } = n,
    s = b.useRef(!1),
    c = b.useRef(null),
    d = b.useRef(null),
    h = Os((v) => {
      (c.current && (clearTimeout(c.current), (c.current = null)),
        d.current && (clearTimeout(d.current), (d.current = null)),
        (s.current = !0),
        i?.(v));
    }),
    m = Os((v) => {
      ((c.current = setTimeout(() => {
        d.current = setTimeout(() => {
          s.current = !1;
        });
      })),
        o?.(v));
    }),
    p = Os((v) => {
      if (
        s.current &&
        (v.key === "Escape" || (v.key === "Enter" && !v.shiftKey))
      ) {
        v.stopPropagation();
        return;
      }
      a?.(v);
    }),
    g = Os(() => s.current);
  return {
    onCompositionStart: h,
    onCompositionEnd: m,
    onKeyDown: p,
    isComposing: g,
  };
}
function yd({
  className: n,
  type: a,
  onKeyDown: i,
  onCompositionStart: o,
  onCompositionEnd: s,
  ...c
}) {
  const d = VA(),
    {
      onCompositionStart: h,
      onCompositionEnd: m,
      onKeyDown: p,
    } = YA({
      onKeyDown: (g) => {
        const v = g.nativeEvent.isComposing || d.justEndedComposing();
        (g.key === "Enter" && v) || i?.(g);
      },
      onCompositionStart: (g) => {
        (d.setComposing(!0), o?.(g));
      },
      onCompositionEnd: (g) => {
        (d.markCompositionEnd(),
          setTimeout(() => {
            d.setComposing(!1);
          }, 100),
          s?.(g));
      },
    });
  return O.jsx("input", {
    type: a,
    "data-slot": "input",
    className: Ot(
      "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
      n,
    ),
    onCompositionStart: h,
    onCompositionEnd: m,
    onKeyDown: p,
    ...c,
  });
}
const GA = hb(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
function qb({ className: n, variant: a, ...i }) {
  return O.jsx("div", {
    "data-slot": "alert",
    role: "alert",
    className: Ot(GA({ variant: a }), n),
    ...i,
  });
}
function Pb({ className: n, ...a }) {
  return O.jsx("div", {
    "data-slot": "alert-description",
    className: Ot(
      "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
      n,
    ),
    ...a,
  });
}
function ug() {
  const [n, a] = b.useState(""),
    [i, o] = b.useState(""),
    [s, c] = b.useState(null),
    [, d] = Id(),
    h = rr.auth.login.useMutation({
      onSuccess: (p) => {
        p.success && d("/reports");
      },
      onError: (p) => {
        c(p.message || "Error al iniciar sesión");
      },
    }),
    m = (p) => {
      if ((p.preventDefault(), c(null), !n || !i)) {
        c("Por favor completa todos los campos");
        return;
      }
      h.mutate({ username: n, password: i });
    };
  return O.jsx("div", {
    className:
      "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4",
    children: O.jsxs("div", {
      className: "w-full max-w-md",
      children: [
        O.jsxs("div", {
          className: "text-center mb-8",
          children: [
            O.jsx("h1", {
              className: "text-3xl font-bold text-slate-900 mb-2",
              children: "SERVICIO PATOLOGICO VETNEB",
            }),
            O.jsx("p", {
              className: "text-slate-600",
              children: "Gestión de Informes Veterinarios",
            }),
          ],
        }),
        O.jsxs(mb, {
          className: "border-0 shadow-lg",
          children: [
            O.jsxs(u_, {
              className: "space-y-2",
              children: [
                O.jsx(c_, { children: "Iniciar Sesión" }),
                O.jsx(f_, {
                  children:
                    "Ingresa tus credenciales de clínica para acceder a los informes",
                }),
              ],
            }),
            O.jsxs(pb, {
              children: [
                O.jsxs("form", {
                  onSubmit: m,
                  className: "space-y-4",
                  children: [
                    s &&
                      O.jsxs(qb, {
                        variant: "destructive",
                        children: [
                          O.jsx(Gd, { className: "h-4 w-4" }),
                          O.jsx(Pb, { children: s }),
                        ],
                      }),
                    O.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        O.jsx("label", {
                          htmlFor: "username",
                          className: "text-sm font-medium text-slate-700",
                          children: "Usuario",
                        }),
                        O.jsx(yd, {
                          id: "username",
                          type: "text",
                          placeholder: "Ingresa tu usuario",
                          value: n,
                          onChange: (p) => a(p.target.value),
                          disabled: h.isPending,
                          className: "h-10",
                        }),
                      ],
                    }),
                    O.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        O.jsx("label", {
                          htmlFor: "password",
                          className: "text-sm font-medium text-slate-700",
                          children: "Contraseña",
                        }),
                        O.jsx(yd, {
                          id: "password",
                          type: "password",
                          placeholder: "Ingresa tu contraseña",
                          value: i,
                          onChange: (p) => o(p.target.value),
                          disabled: h.isPending,
                          className: "h-10",
                        }),
                      ],
                    }),
                    O.jsx(qs, {
                      type: "submit",
                      disabled: h.isPending,
                      className: "w-full h-10 mt-6",
                      children: h.isPending
                        ? O.jsxs(O.Fragment, {
                            children: [
                              O.jsx(gb, {
                                className: "mr-2 h-4 w-4 animate-spin",
                              }),
                              "Iniciando sesión...",
                            ],
                          })
                        : "Iniciar Sesión",
                    }),
                  ],
                }),
                O.jsx("div", {
                  className:
                    "mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200",
                  children: O.jsxs("p", {
                    className: "text-sm text-blue-900",
                    children: [
                      O.jsx("strong", { children: "Demo:" }),
                      " Usa credenciales de prueba para acceder.",
                    ],
                  }),
                }),
              ],
            }),
          ],
        }),
        O.jsx("p", {
          className: "text-center text-sm text-slate-600 mt-6",
          children: "© 2026 Portal VETNEB. Todos los derechos reservados.",
        }),
      ],
    }),
  });
}
function cg(n, [a, i]) {
  return Math.min(i, Math.max(a, n));
}
function fg(n) {
  const a = KA(n),
    i = b.forwardRef((o, s) => {
      const { children: c, ...d } = o,
        h = b.Children.toArray(c),
        m = h.find(IA);
      if (m) {
        const p = m.props.children,
          g = h.map((v) =>
            v === m
              ? b.Children.count(p) > 1
                ? b.Children.only(null)
                : b.isValidElement(p)
                  ? p.props.children
                  : null
              : v,
          );
        return O.jsx(a, {
          ...d,
          ref: s,
          children: b.isValidElement(p) ? b.cloneElement(p, void 0, g) : null,
        });
      }
      return O.jsx(a, { ...d, ref: s, children: c });
    });
  return ((i.displayName = `${n}.Slot`), i);
}
function KA(n) {
  const a = b.forwardRef((i, o) => {
    const { children: s, ...c } = i;
    if (b.isValidElement(s)) {
      const d = FA(s),
        h = ZA(c, s.props);
      return (
        s.type !== b.Fragment && (h.ref = o ? Xl(o, d) : d),
        b.cloneElement(s, h)
      );
    }
    return b.Children.count(s) > 1 ? b.Children.only(null) : null;
  });
  return ((a.displayName = `${n}.SlotClone`), a);
}
var XA = Symbol("radix.slottable");
function IA(n) {
  return (
    b.isValidElement(n) &&
    typeof n.type == "function" &&
    "__radixId" in n.type &&
    n.type.__radixId === XA
  );
}
function ZA(n, a) {
  const i = { ...a };
  for (const o in a) {
    const s = n[o],
      c = a[o];
    /^on[A-Z]/.test(o)
      ? s && c
        ? (i[o] = (...h) => {
            const m = c(...h);
            return (s(...h), m);
          })
        : s && (i[o] = s)
      : o === "style"
        ? (i[o] = { ...s, ...c })
        : o === "className" && (i[o] = [s, c].filter(Boolean).join(" "));
  }
  return { ...n, ...i };
}
function FA(n) {
  let a = Object.getOwnPropertyDescriptor(n.props, "ref")?.get,
    i = a && "isReactWarning" in a && a.isReactWarning;
  return i
    ? n.ref
    : ((a = Object.getOwnPropertyDescriptor(n, "ref")?.get),
      (i = a && "isReactWarning" in a && a.isReactWarning),
      i ? n.props.ref : n.props.ref || n.ref);
}
function $A(n) {
  const a = n + "CollectionProvider",
    [i, o] = Zs(a),
    [s, c] = i(a, { collectionRef: { current: null }, itemMap: new Map() }),
    d = (S) => {
      const { scope: R, children: M } = S,
        j = ie.useRef(null),
        q = ie.useRef(new Map()).current;
      return O.jsx(s, { scope: R, itemMap: q, collectionRef: j, children: M });
    };
  d.displayName = a;
  const h = n + "CollectionSlot",
    m = fg(h),
    p = ie.forwardRef((S, R) => {
      const { scope: M, children: j } = S,
        q = c(h, M),
        Z = st(R, q.collectionRef);
      return O.jsx(m, { ref: Z, children: j });
    });
  p.displayName = h;
  const g = n + "CollectionItemSlot",
    v = "data-radix-collection-item",
    w = fg(g),
    E = ie.forwardRef((S, R) => {
      const { scope: M, children: j, ...q } = S,
        Z = ie.useRef(null),
        Q = st(R, Z),
        V = c(g, M);
      return (
        ie.useEffect(
          () => (
            V.itemMap.set(Z, { ref: Z, ...q }),
            () => {
              V.itemMap.delete(Z);
            }
          ),
        ),
        O.jsx(w, { [v]: "", ref: Q, children: j })
      );
    });
  E.displayName = g;
  function C(S) {
    const R = c(n + "CollectionConsumer", S);
    return ie.useCallback(() => {
      const j = R.collectionRef.current;
      if (!j) return [];
      const q = Array.from(j.querySelectorAll(`[${v}]`));
      return Array.from(R.itemMap.values()).sort(
        (V, N) => q.indexOf(V.ref.current) - q.indexOf(N.ref.current),
      );
    }, [R.collectionRef, R.itemMap]);
  }
  return [{ Provider: d, Slot: p, ItemSlot: E }, C, o];
}
var JA = b.createContext(void 0);
function WA(n) {
  const a = b.useContext(JA);
  return n || a || "ltr";
}
function eR(n) {
  const a = tR(n),
    i = b.forwardRef((o, s) => {
      const { children: c, ...d } = o,
        h = b.Children.toArray(c),
        m = h.find(rR);
      if (m) {
        const p = m.props.children,
          g = h.map((v) =>
            v === m
              ? b.Children.count(p) > 1
                ? b.Children.only(null)
                : b.isValidElement(p)
                  ? p.props.children
                  : null
              : v,
          );
        return O.jsx(a, {
          ...d,
          ref: s,
          children: b.isValidElement(p) ? b.cloneElement(p, void 0, g) : null,
        });
      }
      return O.jsx(a, { ...d, ref: s, children: c });
    });
  return ((i.displayName = `${n}.Slot`), i);
}
function tR(n) {
  const a = b.forwardRef((i, o) => {
    const { children: s, ...c } = i;
    if (b.isValidElement(s)) {
      const d = iR(s),
        h = aR(c, s.props);
      return (
        s.type !== b.Fragment && (h.ref = o ? Xl(o, d) : d),
        b.cloneElement(s, h)
      );
    }
    return b.Children.count(s) > 1 ? b.Children.only(null) : null;
  });
  return ((a.displayName = `${n}.SlotClone`), a);
}
var nR = Symbol("radix.slottable");
function rR(n) {
  return (
    b.isValidElement(n) &&
    typeof n.type == "function" &&
    "__radixId" in n.type &&
    n.type.__radixId === nR
  );
}
function aR(n, a) {
  const i = { ...a };
  for (const o in a) {
    const s = n[o],
      c = a[o];
    /^on[A-Z]/.test(o)
      ? s && c
        ? (i[o] = (...h) => {
            const m = c(...h);
            return (s(...h), m);
          })
        : s && (i[o] = s)
      : o === "style"
        ? (i[o] = { ...s, ...c })
        : o === "className" && (i[o] = [s, c].filter(Boolean).join(" "));
  }
  return { ...n, ...i };
}
function iR(n) {
  let a = Object.getOwnPropertyDescriptor(n.props, "ref")?.get,
    i = a && "isReactWarning" in a && a.isReactWarning;
  return i
    ? n.ref
    : ((a = Object.getOwnPropertyDescriptor(n, "ref")?.get),
      (i = a && "isReactWarning" in a && a.isReactWarning),
      i ? n.props.ref : n.props.ref || n.ref);
}
function lR(n) {
  const a = b.useRef({ value: n, previous: n });
  return b.useMemo(
    () => (
      a.current.value !== n &&
        ((a.current.previous = a.current.value), (a.current.value = n)),
      a.current.previous
    ),
    [n],
  );
}
var oR = [" ", "Enter", "ArrowUp", "ArrowDown"],
  sR = [" ", "Enter"],
  Ca = "Select",
  [iu, lu, uR] = $A(Ca),
  [Mi] = Zs(Ca, [uR, eu]),
  ou = eu(),
  [cR, Ir] = Mi(Ca),
  [fR, dR] = Mi(Ca),
  kb = (n) => {
    const {
        __scopeSelect: a,
        children: i,
        open: o,
        defaultOpen: s,
        onOpenChange: c,
        value: d,
        defaultValue: h,
        onValueChange: m,
        dir: p,
        name: g,
        autoComplete: v,
        disabled: w,
        required: E,
        form: C,
      } = n,
      S = ou(a),
      [R, M] = b.useState(null),
      [j, q] = b.useState(null),
      [Z, Q] = b.useState(!1),
      V = WA(p),
      [N, U] = zy({ prop: o, defaultProp: s ?? !1, onChange: c, caller: Ca }),
      [W, ne] = zy({ prop: d, defaultProp: h, onChange: m, caller: Ca }),
      ae = b.useRef(null),
      te = R ? C || !!R.closest("form") : !0,
      [oe, se] = b.useState(new Set()),
      ce = Array.from(oe)
        .map((A) => A.props.value)
        .join(";");
    return O.jsx(jC, {
      ...S,
      children: O.jsxs(cR, {
        required: E,
        scope: a,
        trigger: R,
        onTriggerChange: M,
        valueNode: j,
        onValueNodeChange: q,
        valueNodeHasChildren: Z,
        onValueNodeHasChildrenChange: Q,
        contentId: jd(),
        value: W,
        onValueChange: ne,
        open: N,
        onOpenChange: U,
        dir: V,
        triggerPointerDownPosRef: ae,
        disabled: w,
        children: [
          O.jsx(iu.Provider, {
            scope: a,
            children: O.jsx(fR, {
              scope: n.__scopeSelect,
              onNativeOptionAdd: b.useCallback((A) => {
                se((B) => new Set(B).add(A));
              }, []),
              onNativeOptionRemove: b.useCallback((A) => {
                se((B) => {
                  const K = new Set(B);
                  return (K.delete(A), K);
                });
              }, []),
              children: i,
            }),
          }),
          te
            ? O.jsxs(
                ux,
                {
                  "aria-hidden": !0,
                  required: E,
                  tabIndex: -1,
                  name: g,
                  autoComplete: v,
                  value: W,
                  onChange: (A) => ne(A.target.value),
                  disabled: w,
                  form: C,
                  children: [
                    W === void 0 ? O.jsx("option", { value: "" }) : null,
                    Array.from(oe),
                  ],
                },
                ce,
              )
            : null,
        ],
      }),
    });
  };
kb.displayName = Ca;
var Qb = "SelectTrigger",
  Vb = b.forwardRef((n, a) => {
    const { __scopeSelect: i, disabled: o = !1, ...s } = n,
      c = ou(i),
      d = Ir(Qb, i),
      h = d.disabled || o,
      m = st(a, d.onTriggerChange),
      p = lu(i),
      g = b.useRef("touch"),
      [v, w, E] = fx((S) => {
        const R = p().filter((q) => !q.disabled),
          M = R.find((q) => q.value === d.value),
          j = dx(R, S, M);
        j !== void 0 && d.onValueChange(j.value);
      }),
      C = (S) => {
        (h || (d.onOpenChange(!0), E()),
          S &&
            (d.triggerPointerDownPosRef.current = {
              x: Math.round(S.pageX),
              y: Math.round(S.pageY),
            }));
      };
    return O.jsx(H0, {
      asChild: !0,
      ...c,
      children: O.jsx(We.button, {
        type: "button",
        role: "combobox",
        "aria-controls": d.contentId,
        "aria-expanded": d.open,
        "aria-required": d.required,
        "aria-autocomplete": "none",
        dir: d.dir,
        "data-state": d.open ? "open" : "closed",
        disabled: h,
        "data-disabled": h ? "" : void 0,
        "data-placeholder": cx(d.value) ? "" : void 0,
        ...s,
        ref: m,
        onClick: Ve(s.onClick, (S) => {
          (S.currentTarget.focus(), g.current !== "mouse" && C(S));
        }),
        onPointerDown: Ve(s.onPointerDown, (S) => {
          g.current = S.pointerType;
          const R = S.target;
          (R.hasPointerCapture(S.pointerId) &&
            R.releasePointerCapture(S.pointerId),
            S.button === 0 &&
              S.ctrlKey === !1 &&
              S.pointerType === "mouse" &&
              (C(S), S.preventDefault()));
        }),
        onKeyDown: Ve(s.onKeyDown, (S) => {
          const R = v.current !== "";
          (!(S.ctrlKey || S.altKey || S.metaKey) &&
            S.key.length === 1 &&
            w(S.key),
            !(R && S.key === " ") &&
              oR.includes(S.key) &&
              (C(), S.preventDefault()));
        }),
      }),
    });
  });
Vb.displayName = Qb;
var Yb = "SelectValue",
  Gb = b.forwardRef((n, a) => {
    const {
        __scopeSelect: i,
        className: o,
        style: s,
        children: c,
        placeholder: d = "",
        ...h
      } = n,
      m = Ir(Yb, i),
      { onValueNodeHasChildrenChange: p } = m,
      g = c !== void 0,
      v = st(a, m.onValueNodeChange);
    return (
      Et(() => {
        p(g);
      }, [p, g]),
      O.jsx(We.span, {
        ...h,
        ref: v,
        style: { pointerEvents: "none" },
        children: cx(m.value) ? O.jsx(O.Fragment, { children: d }) : c,
      })
    );
  });
Gb.displayName = Yb;
var hR = "SelectIcon",
  Kb = b.forwardRef((n, a) => {
    const { __scopeSelect: i, children: o, ...s } = n;
    return O.jsx(We.span, {
      "aria-hidden": !0,
      ...s,
      ref: a,
      children: o || "▼",
    });
  });
Kb.displayName = hR;
var mR = "SelectPortal",
  Xb = (n) => O.jsx(P0, { asChild: !0, ...n });
Xb.displayName = mR;
var Ta = "SelectContent",
  Ib = b.forwardRef((n, a) => {
    const i = Ir(Ta, n.__scopeSelect),
      [o, s] = b.useState();
    if (
      (Et(() => {
        s(new DocumentFragment());
      }, []),
      !i.open)
    ) {
      const c = o;
      return c
        ? Kl.createPortal(
            O.jsx(Zb, {
              scope: n.__scopeSelect,
              children: O.jsx(iu.Slot, {
                scope: n.__scopeSelect,
                children: O.jsx("div", { children: n.children }),
              }),
            }),
            c,
          )
        : null;
    }
    return O.jsx(Fb, { ...n, ref: a });
  });
Ib.displayName = Ta;
var vn = 10,
  [Zb, Zr] = Mi(Ta),
  pR = "SelectContentImpl",
  vR = eR("SelectContent.RemoveScroll"),
  Fb = b.forwardRef((n, a) => {
    const {
        __scopeSelect: i,
        position: o = "item-aligned",
        onCloseAutoFocus: s,
        onEscapeKeyDown: c,
        onPointerDownOutside: d,
        side: h,
        sideOffset: m,
        align: p,
        alignOffset: g,
        arrowPadding: v,
        collisionBoundary: w,
        collisionPadding: E,
        sticky: C,
        hideWhenDetached: S,
        avoidCollisions: R,
        ...M
      } = n,
      j = Ir(Ta, i),
      [q, Z] = b.useState(null),
      [Q, V] = b.useState(null),
      N = st(a, (re) => Z(re)),
      [U, W] = b.useState(null),
      [ne, ae] = b.useState(null),
      te = lu(i),
      [oe, se] = b.useState(!1),
      ce = b.useRef(!1);
    (b.useEffect(() => {
      if (q) return kA(q);
    }, [q]),
      tA());
    const A = b.useCallback(
        (re) => {
          const [de, ...pe] = te().map((Re) => Re.ref.current),
            [Oe] = pe.slice(-1),
            Ce = document.activeElement;
          for (const Re of re)
            if (
              Re === Ce ||
              (Re?.scrollIntoView({ block: "nearest" }),
              Re === de && Q && (Q.scrollTop = 0),
              Re === Oe && Q && (Q.scrollTop = Q.scrollHeight),
              Re?.focus(),
              document.activeElement !== Ce)
            )
              return;
        },
        [te, Q],
      ),
      B = b.useCallback(() => A([U, q]), [A, U, q]);
    b.useEffect(() => {
      oe && B();
    }, [oe, B]);
    const { onOpenChange: K, triggerPointerDownPosRef: le } = j;
    (b.useEffect(() => {
      if (q) {
        let re = { x: 0, y: 0 };
        const de = (Oe) => {
            re = {
              x: Math.abs(Math.round(Oe.pageX) - (le.current?.x ?? 0)),
              y: Math.abs(Math.round(Oe.pageY) - (le.current?.y ?? 0)),
            };
          },
          pe = (Oe) => {
            (re.x <= 10 && re.y <= 10
              ? Oe.preventDefault()
              : q.contains(Oe.target) || K(!1),
              document.removeEventListener("pointermove", de),
              (le.current = null));
          };
        return (
          le.current !== null &&
            (document.addEventListener("pointermove", de),
            document.addEventListener("pointerup", pe, {
              capture: !0,
              once: !0,
            })),
          () => {
            (document.removeEventListener("pointermove", de),
              document.removeEventListener("pointerup", pe, { capture: !0 }));
          }
        );
      }
    }, [q, K, le]),
      b.useEffect(() => {
        const re = () => K(!1);
        return (
          window.addEventListener("blur", re),
          window.addEventListener("resize", re),
          () => {
            (window.removeEventListener("blur", re),
              window.removeEventListener("resize", re));
          }
        );
      }, [K]));
    const [J, T] = fx((re) => {
        const de = te().filter((Ce) => !Ce.disabled),
          pe = de.find((Ce) => Ce.ref.current === document.activeElement),
          Oe = dx(de, re, pe);
        Oe && setTimeout(() => Oe.ref.current.focus());
      }),
      G = b.useCallback(
        (re, de, pe) => {
          const Oe = !ce.current && !pe;
          ((j.value !== void 0 && j.value === de) || Oe) &&
            (W(re), Oe && (ce.current = !0));
        },
        [j.value],
      ),
      k = b.useCallback(() => q?.focus(), [q]),
      I = b.useCallback(
        (re, de, pe) => {
          const Oe = !ce.current && !pe;
          ((j.value !== void 0 && j.value === de) || Oe) && ae(re);
        },
        [j.value],
      ),
      ee = o === "popper" ? gd : $b,
      ue =
        ee === gd
          ? {
              side: h,
              sideOffset: m,
              align: p,
              alignOffset: g,
              arrowPadding: v,
              collisionBoundary: w,
              collisionPadding: E,
              sticky: C,
              hideWhenDetached: S,
              avoidCollisions: R,
            }
          : {};
    return O.jsx(Zb, {
      scope: i,
      content: q,
      viewport: Q,
      onViewportChange: V,
      itemRefCallback: G,
      selectedItem: U,
      onItemLeave: k,
      itemTextRefCallback: I,
      focusSelectedItem: B,
      selectedItemText: ne,
      position: o,
      isPositioned: oe,
      searchRef: J,
      children: O.jsx(Hb, {
        as: vR,
        allowPinchZoom: !0,
        children: O.jsx(Ab, {
          asChild: !0,
          trapped: j.open,
          onMountAutoFocus: (re) => {
            re.preventDefault();
          },
          onUnmountAutoFocus: Ve(s, (re) => {
            (j.trigger?.focus({ preventScroll: !0 }), re.preventDefault());
          }),
          children: O.jsx(Dd, {
            asChild: !0,
            disableOutsidePointerEvents: !0,
            onEscapeKeyDown: c,
            onPointerDownOutside: d,
            onFocusOutside: (re) => re.preventDefault(),
            onDismiss: () => j.onOpenChange(!1),
            children: O.jsx(ee, {
              role: "listbox",
              id: j.contentId,
              "data-state": j.open ? "open" : "closed",
              dir: j.dir,
              onContextMenu: (re) => re.preventDefault(),
              ...M,
              ...ue,
              onPlaced: () => se(!0),
              ref: N,
              style: {
                display: "flex",
                flexDirection: "column",
                outline: "none",
                ...M.style,
              },
              onKeyDown: Ve(M.onKeyDown, (re) => {
                const de = re.ctrlKey || re.altKey || re.metaKey;
                if (
                  (re.key === "Tab" && re.preventDefault(),
                  !de && re.key.length === 1 && T(re.key),
                  ["ArrowUp", "ArrowDown", "Home", "End"].includes(re.key))
                ) {
                  let Oe = te()
                    .filter((Ce) => !Ce.disabled)
                    .map((Ce) => Ce.ref.current);
                  if (
                    (["ArrowUp", "End"].includes(re.key) &&
                      (Oe = Oe.slice().reverse()),
                    ["ArrowUp", "ArrowDown"].includes(re.key))
                  ) {
                    const Ce = re.target,
                      Re = Oe.indexOf(Ce);
                    Oe = Oe.slice(Re + 1);
                  }
                  (setTimeout(() => A(Oe)), re.preventDefault());
                }
              }),
            }),
          }),
        }),
      }),
    });
  });
Fb.displayName = pR;
var yR = "SelectItemAlignedPosition",
  $b = b.forwardRef((n, a) => {
    const { __scopeSelect: i, onPlaced: o, ...s } = n,
      c = Ir(Ta, i),
      d = Zr(Ta, i),
      [h, m] = b.useState(null),
      [p, g] = b.useState(null),
      v = st(a, (N) => g(N)),
      w = lu(i),
      E = b.useRef(!1),
      C = b.useRef(!0),
      {
        viewport: S,
        selectedItem: R,
        selectedItemText: M,
        focusSelectedItem: j,
      } = d,
      q = b.useCallback(() => {
        if (c.trigger && c.valueNode && h && p && S && R && M) {
          const N = c.trigger.getBoundingClientRect(),
            U = p.getBoundingClientRect(),
            W = c.valueNode.getBoundingClientRect(),
            ne = M.getBoundingClientRect();
          if (c.dir !== "rtl") {
            const Ce = ne.left - U.left,
              Re = W.left - Ce,
              et = N.left - Re,
              Ke = N.width + et,
              Ln = Math.max(Ke, U.width),
              Sn = window.innerWidth - vn,
              cn = cg(Re, [vn, Math.max(vn, Sn - Ln)]);
            ((h.style.minWidth = Ke + "px"), (h.style.left = cn + "px"));
          } else {
            const Ce = U.right - ne.right,
              Re = window.innerWidth - W.right - Ce,
              et = window.innerWidth - N.right - Re,
              Ke = N.width + et,
              Ln = Math.max(Ke, U.width),
              Sn = window.innerWidth - vn,
              cn = cg(Re, [vn, Math.max(vn, Sn - Ln)]);
            ((h.style.minWidth = Ke + "px"), (h.style.right = cn + "px"));
          }
          const ae = w(),
            te = window.innerHeight - vn * 2,
            oe = S.scrollHeight,
            se = window.getComputedStyle(p),
            ce = parseInt(se.borderTopWidth, 10),
            A = parseInt(se.paddingTop, 10),
            B = parseInt(se.borderBottomWidth, 10),
            K = parseInt(se.paddingBottom, 10),
            le = ce + A + oe + K + B,
            J = Math.min(R.offsetHeight * 5, le),
            T = window.getComputedStyle(S),
            G = parseInt(T.paddingTop, 10),
            k = parseInt(T.paddingBottom, 10),
            I = N.top + N.height / 2 - vn,
            ee = te - I,
            ue = R.offsetHeight / 2,
            re = R.offsetTop + ue,
            de = ce + A + re,
            pe = le - de;
          if (de <= I) {
            const Ce = ae.length > 0 && R === ae[ae.length - 1].ref.current;
            h.style.bottom = "0px";
            const Re = p.clientHeight - S.offsetTop - S.offsetHeight,
              et = Math.max(ee, ue + (Ce ? k : 0) + Re + B),
              Ke = de + et;
            h.style.height = Ke + "px";
          } else {
            const Ce = ae.length > 0 && R === ae[0].ref.current;
            h.style.top = "0px";
            const et = Math.max(I, ce + S.offsetTop + (Ce ? G : 0) + ue) + pe;
            ((h.style.height = et + "px"),
              (S.scrollTop = de - I + S.offsetTop));
          }
          ((h.style.margin = `${vn}px 0`),
            (h.style.minHeight = J + "px"),
            (h.style.maxHeight = te + "px"),
            o?.(),
            requestAnimationFrame(() => (E.current = !0)));
        }
      }, [w, c.trigger, c.valueNode, h, p, S, R, M, c.dir, o]);
    Et(() => q(), [q]);
    const [Z, Q] = b.useState();
    Et(() => {
      p && Q(window.getComputedStyle(p).zIndex);
    }, [p]);
    const V = b.useCallback(
      (N) => {
        N && C.current === !0 && (q(), j?.(), (C.current = !1));
      },
      [q, j],
    );
    return O.jsx(bR, {
      scope: i,
      contentWrapper: h,
      shouldExpandOnScrollRef: E,
      onScrollButtonChange: V,
      children: O.jsx("div", {
        ref: m,
        style: {
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          zIndex: Z,
        },
        children: O.jsx(We.div, {
          ...s,
          ref: v,
          style: { boxSizing: "border-box", maxHeight: "100%", ...s.style },
        }),
      }),
    });
  });
$b.displayName = yR;
var gR = "SelectPopperPosition",
  gd = b.forwardRef((n, a) => {
    const {
        __scopeSelect: i,
        align: o = "start",
        collisionPadding: s = vn,
        ...c
      } = n,
      d = ou(i);
    return O.jsx(B0, {
      ...d,
      ...c,
      ref: a,
      align: o,
      collisionPadding: s,
      style: {
        boxSizing: "border-box",
        ...c.style,
        "--radix-select-content-transform-origin":
          "var(--radix-popper-transform-origin)",
        "--radix-select-content-available-width":
          "var(--radix-popper-available-width)",
        "--radix-select-content-available-height":
          "var(--radix-popper-available-height)",
        "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
        "--radix-select-trigger-height": "var(--radix-popper-anchor-height)",
      },
    });
  });
gd.displayName = gR;
var [bR, Zd] = Mi(Ta, {}),
  bd = "SelectViewport",
  Jb = b.forwardRef((n, a) => {
    const { __scopeSelect: i, nonce: o, ...s } = n,
      c = Zr(bd, i),
      d = Zd(bd, i),
      h = st(a, c.onViewportChange),
      m = b.useRef(0);
    return O.jsxs(O.Fragment, {
      children: [
        O.jsx("style", {
          dangerouslySetInnerHTML: {
            __html:
              "[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}",
          },
          nonce: o,
        }),
        O.jsx(iu.Slot, {
          scope: i,
          children: O.jsx(We.div, {
            "data-radix-select-viewport": "",
            role: "presentation",
            ...s,
            ref: h,
            style: {
              position: "relative",
              flex: 1,
              overflow: "hidden auto",
              ...s.style,
            },
            onScroll: Ve(s.onScroll, (p) => {
              const g = p.currentTarget,
                { contentWrapper: v, shouldExpandOnScrollRef: w } = d;
              if (w?.current && v) {
                const E = Math.abs(m.current - g.scrollTop);
                if (E > 0) {
                  const C = window.innerHeight - vn * 2,
                    S = parseFloat(v.style.minHeight),
                    R = parseFloat(v.style.height),
                    M = Math.max(S, R);
                  if (M < C) {
                    const j = M + E,
                      q = Math.min(C, j),
                      Z = j - q;
                    ((v.style.height = q + "px"),
                      v.style.bottom === "0px" &&
                        ((g.scrollTop = Z > 0 ? Z : 0),
                        (v.style.justifyContent = "flex-end")));
                  }
                }
              }
              m.current = g.scrollTop;
            }),
          }),
        }),
      ],
    });
  });
Jb.displayName = bd;
var Wb = "SelectGroup",
  [xR, SR] = Mi(Wb),
  wR = b.forwardRef((n, a) => {
    const { __scopeSelect: i, ...o } = n,
      s = jd();
    return O.jsx(xR, {
      scope: i,
      id: s,
      children: O.jsx(We.div, {
        role: "group",
        "aria-labelledby": s,
        ...o,
        ref: a,
      }),
    });
  });
wR.displayName = Wb;
var ex = "SelectLabel",
  ER = b.forwardRef((n, a) => {
    const { __scopeSelect: i, ...o } = n,
      s = SR(ex, i);
    return O.jsx(We.div, { id: s.id, ...o, ref: a });
  });
ER.displayName = ex;
var Ps = "SelectItem",
  [OR, tx] = Mi(Ps),
  nx = b.forwardRef((n, a) => {
    const {
        __scopeSelect: i,
        value: o,
        disabled: s = !1,
        textValue: c,
        ...d
      } = n,
      h = Ir(Ps, i),
      m = Zr(Ps, i),
      p = h.value === o,
      [g, v] = b.useState(c ?? ""),
      [w, E] = b.useState(!1),
      C = st(a, (j) => m.itemRefCallback?.(j, o, s)),
      S = jd(),
      R = b.useRef("touch"),
      M = () => {
        s || (h.onValueChange(o), h.onOpenChange(!1));
      };
    if (o === "")
      throw new Error(
        "A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.",
      );
    return O.jsx(OR, {
      scope: i,
      value: o,
      disabled: s,
      textId: S,
      isSelected: p,
      onItemTextChange: b.useCallback((j) => {
        v((q) => q || (j?.textContent ?? "").trim());
      }, []),
      children: O.jsx(iu.ItemSlot, {
        scope: i,
        value: o,
        disabled: s,
        textValue: g,
        children: O.jsx(We.div, {
          role: "option",
          "aria-labelledby": S,
          "data-highlighted": w ? "" : void 0,
          "aria-selected": p && w,
          "data-state": p ? "checked" : "unchecked",
          "aria-disabled": s || void 0,
          "data-disabled": s ? "" : void 0,
          tabIndex: s ? void 0 : -1,
          ...d,
          ref: C,
          onFocus: Ve(d.onFocus, () => E(!0)),
          onBlur: Ve(d.onBlur, () => E(!1)),
          onClick: Ve(d.onClick, () => {
            R.current !== "mouse" && M();
          }),
          onPointerUp: Ve(d.onPointerUp, () => {
            R.current === "mouse" && M();
          }),
          onPointerDown: Ve(d.onPointerDown, (j) => {
            R.current = j.pointerType;
          }),
          onPointerMove: Ve(d.onPointerMove, (j) => {
            ((R.current = j.pointerType),
              s
                ? m.onItemLeave?.()
                : R.current === "mouse" &&
                  j.currentTarget.focus({ preventScroll: !0 }));
          }),
          onPointerLeave: Ve(d.onPointerLeave, (j) => {
            j.currentTarget === document.activeElement && m.onItemLeave?.();
          }),
          onKeyDown: Ve(d.onKeyDown, (j) => {
            (m.searchRef?.current !== "" && j.key === " ") ||
              (sR.includes(j.key) && M(), j.key === " " && j.preventDefault());
          }),
        }),
      }),
    });
  });
nx.displayName = Ps;
var Ml = "SelectItemText",
  rx = b.forwardRef((n, a) => {
    const { __scopeSelect: i, className: o, style: s, ...c } = n,
      d = Ir(Ml, i),
      h = Zr(Ml, i),
      m = tx(Ml, i),
      p = dR(Ml, i),
      [g, v] = b.useState(null),
      w = st(
        a,
        (M) => v(M),
        m.onItemTextChange,
        (M) => h.itemTextRefCallback?.(M, m.value, m.disabled),
      ),
      E = g?.textContent,
      C = b.useMemo(
        () =>
          O.jsx(
            "option",
            { value: m.value, disabled: m.disabled, children: E },
            m.value,
          ),
        [m.disabled, m.value, E],
      ),
      { onNativeOptionAdd: S, onNativeOptionRemove: R } = p;
    return (
      Et(() => (S(C), () => R(C)), [S, R, C]),
      O.jsxs(O.Fragment, {
        children: [
          O.jsx(We.span, { id: m.textId, ...c, ref: w }),
          m.isSelected && d.valueNode && !d.valueNodeHasChildren
            ? Kl.createPortal(c.children, d.valueNode)
            : null,
        ],
      })
    );
  });
rx.displayName = Ml;
var ax = "SelectItemIndicator",
  ix = b.forwardRef((n, a) => {
    const { __scopeSelect: i, ...o } = n;
    return tx(ax, i).isSelected
      ? O.jsx(We.span, { "aria-hidden": !0, ...o, ref: a })
      : null;
  });
ix.displayName = ax;
var xd = "SelectScrollUpButton",
  lx = b.forwardRef((n, a) => {
    const i = Zr(xd, n.__scopeSelect),
      o = Zd(xd, n.__scopeSelect),
      [s, c] = b.useState(!1),
      d = st(a, o.onScrollButtonChange);
    return (
      Et(() => {
        if (i.viewport && i.isPositioned) {
          let h = function () {
            const p = m.scrollTop > 0;
            c(p);
          };
          const m = i.viewport;
          return (
            h(),
            m.addEventListener("scroll", h),
            () => m.removeEventListener("scroll", h)
          );
        }
      }, [i.viewport, i.isPositioned]),
      s
        ? O.jsx(sx, {
            ...n,
            ref: d,
            onAutoScroll: () => {
              const { viewport: h, selectedItem: m } = i;
              h && m && (h.scrollTop = h.scrollTop - m.offsetHeight);
            },
          })
        : null
    );
  });
lx.displayName = xd;
var Sd = "SelectScrollDownButton",
  ox = b.forwardRef((n, a) => {
    const i = Zr(Sd, n.__scopeSelect),
      o = Zd(Sd, n.__scopeSelect),
      [s, c] = b.useState(!1),
      d = st(a, o.onScrollButtonChange);
    return (
      Et(() => {
        if (i.viewport && i.isPositioned) {
          let h = function () {
            const p = m.scrollHeight - m.clientHeight,
              g = Math.ceil(m.scrollTop) < p;
            c(g);
          };
          const m = i.viewport;
          return (
            h(),
            m.addEventListener("scroll", h),
            () => m.removeEventListener("scroll", h)
          );
        }
      }, [i.viewport, i.isPositioned]),
      s
        ? O.jsx(sx, {
            ...n,
            ref: d,
            onAutoScroll: () => {
              const { viewport: h, selectedItem: m } = i;
              h && m && (h.scrollTop = h.scrollTop + m.offsetHeight);
            },
          })
        : null
    );
  });
ox.displayName = Sd;
var sx = b.forwardRef((n, a) => {
    const { __scopeSelect: i, onAutoScroll: o, ...s } = n,
      c = Zr("SelectScrollButton", i),
      d = b.useRef(null),
      h = lu(i),
      m = b.useCallback(() => {
        d.current !== null &&
          (window.clearInterval(d.current), (d.current = null));
      }, []);
    return (
      b.useEffect(() => () => m(), [m]),
      Et(() => {
        h()
          .find((g) => g.ref.current === document.activeElement)
          ?.ref.current?.scrollIntoView({ block: "nearest" });
      }, [h]),
      O.jsx(We.div, {
        "aria-hidden": !0,
        ...s,
        ref: a,
        style: { flexShrink: 0, ...s.style },
        onPointerDown: Ve(s.onPointerDown, () => {
          d.current === null && (d.current = window.setInterval(o, 50));
        }),
        onPointerMove: Ve(s.onPointerMove, () => {
          (c.onItemLeave?.(),
            d.current === null && (d.current = window.setInterval(o, 50)));
        }),
        onPointerLeave: Ve(s.onPointerLeave, () => {
          m();
        }),
      })
    );
  }),
  CR = "SelectSeparator",
  TR = b.forwardRef((n, a) => {
    const { __scopeSelect: i, ...o } = n;
    return O.jsx(We.div, { "aria-hidden": !0, ...o, ref: a });
  });
TR.displayName = CR;
var wd = "SelectArrow",
  _R = b.forwardRef((n, a) => {
    const { __scopeSelect: i, ...o } = n,
      s = ou(i),
      c = Ir(wd, i),
      d = Zr(wd, i);
    return c.open && d.position === "popper"
      ? O.jsx(q0, { ...s, ...o, ref: a })
      : null;
  });
_R.displayName = wd;
var AR = "SelectBubbleInput",
  ux = b.forwardRef(({ __scopeSelect: n, value: a, ...i }, o) => {
    const s = b.useRef(null),
      c = st(o, s),
      d = lR(a);
    return (
      b.useEffect(() => {
        const h = s.current;
        if (!h) return;
        const m = window.HTMLSelectElement.prototype,
          g = Object.getOwnPropertyDescriptor(m, "value").set;
        if (d !== a && g) {
          const v = new Event("change", { bubbles: !0 });
          (g.call(h, a), h.dispatchEvent(v));
        }
      }, [d, a]),
      O.jsx(We.select, {
        ...i,
        style: { ...Q0, ...i.style },
        ref: c,
        defaultValue: a,
      })
    );
  });
ux.displayName = AR;
function cx(n) {
  return n === "" || n === void 0;
}
function fx(n) {
  const a = Ea(n),
    i = b.useRef(""),
    o = b.useRef(0),
    s = b.useCallback(
      (d) => {
        const h = i.current + d;
        (a(h),
          (function m(p) {
            ((i.current = p),
              window.clearTimeout(o.current),
              p !== "" && (o.current = window.setTimeout(() => m(""), 1e3)));
          })(h));
      },
      [a],
    ),
    c = b.useCallback(() => {
      ((i.current = ""), window.clearTimeout(o.current));
    }, []);
  return (
    b.useEffect(() => () => window.clearTimeout(o.current), []),
    [i, s, c]
  );
}
function dx(n, a, i) {
  const s = a.length > 1 && Array.from(a).every((p) => p === a[0]) ? a[0] : a,
    c = i ? n.indexOf(i) : -1;
  let d = RR(n, Math.max(c, 0));
  s.length === 1 && (d = d.filter((p) => p !== i));
  const m = d.find((p) =>
    p.textValue.toLowerCase().startsWith(s.toLowerCase()),
  );
  return m !== i ? m : void 0;
}
function RR(n, a) {
  return n.map((i, o) => n[(a + o) % n.length]);
}
var MR = kb,
  NR = Vb,
  DR = Gb,
  jR = Kb,
  zR = Xb,
  UR = Ib,
  LR = Jb,
  HR = nx,
  BR = rx,
  qR = ix,
  PR = lx,
  kR = ox;
function QR({ ...n }) {
  return O.jsx(MR, { "data-slot": "select", ...n });
}
function VR({ ...n }) {
  return O.jsx(DR, { "data-slot": "select-value", ...n });
}
function YR({ className: n, size: a = "default", children: i, ...o }) {
  return O.jsxs(NR, {
    "data-slot": "select-trigger",
    "data-size": a,
    className: Ot(
      "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      n,
    ),
    ...o,
    children: [
      i,
      O.jsx(jR, {
        asChild: !0,
        children: O.jsx(yb, { className: "size-4 opacity-50" }),
      }),
    ],
  });
}
function GR({
  className: n,
  children: a,
  position: i = "popper",
  align: o = "center",
  ...s
}) {
  return O.jsx(zR, {
    children: O.jsxs(UR, {
      "data-slot": "select-content",
      className: Ot(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
        i === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        n,
      ),
      position: i,
      align: o,
      ...s,
      children: [
        O.jsx(KR, {}),
        O.jsx(LR, {
          className: Ot(
            "p-1",
            i === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          ),
          children: a,
        }),
        O.jsx(XR, {}),
      ],
    }),
  });
}
function dg({ className: n, children: a, ...i }) {
  return O.jsxs(HR, {
    "data-slot": "select-item",
    className: Ot(
      "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
      n,
    ),
    ...i,
    children: [
      O.jsx("span", {
        className: "absolute right-2 flex size-3.5 items-center justify-center",
        children: O.jsx(qR, { children: O.jsx(p_, { className: "size-4" }) }),
      }),
      O.jsx(BR, { children: a }),
    ],
  });
}
function KR({ className: n, ...a }) {
  return O.jsx(PR, {
    "data-slot": "select-scroll-up-button",
    className: Ot("flex cursor-default items-center justify-center py-1", n),
    ...a,
    children: O.jsx(v_, { className: "size-4" }),
  });
}
function XR({ className: n, ...a }) {
  return O.jsx(kR, {
    "data-slot": "select-scroll-down-button",
    className: Ot("flex cursor-default items-center justify-center py-1", n),
    ...a,
    children: O.jsx(yb, { className: "size-4" }),
  });
}
function IR() {
  const [, n] = Id(),
    [a, i] = b.useState(""),
    [o, s] = b.useState(""),
    [c, d] = b.useState(null),
    { data: h } = rr.auth.me.useQuery(),
    { data: m, isLoading: p } = rr.reports.list.useQuery({ limit: 100 }),
    { data: g = [] } = rr.reports.getStudyTypes.useQuery(),
    { data: v } = rr.reports.search.useQuery(
      { query: a, studyType: o || void 0, limit: 100 },
      { enabled: a.length > 0 || o.length > 0 },
    ),
    { data: w } = rr.reports.getDownloadUrl.useQuery(
      { reportId: c || 0 },
      { enabled: c !== null },
    ),
    E = rr.auth.logout.useMutation({
      onSuccess: () => {
        n("/");
      },
    }),
    C = b.useMemo(
      () => (a || o ? v?.reports || [] : m?.reports || []),
      [a, o, v, m],
    ),
    S = C.find((j) => j.id === c),
    R = () => {
      E.mutate();
    },
    M = () => {
      w?.downloadUrl && window.open(w.downloadUrl, "_blank");
    };
  return O.jsxs("div", {
    className: "min-h-screen flex flex-col bg-slate-50",
    children: [
      O.jsx("div", {
        className: "bg-white border-b border-slate-200 shadow-sm",
        children: O.jsxs("div", {
          className:
            "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between",
          children: [
            O.jsxs("div", {
              children: [
                O.jsx("h1", {
                  className: "text-2xl font-bold text-slate-900",
                  children: "Portal VETNEB",
                }),
                h &&
                  O.jsxs("p", {
                    className: "text-sm text-slate-600",
                    children: ["Clínica: ", h.email],
                  }),
              ],
            }),
            O.jsxs(qs, {
              variant: "outline",
              size: "sm",
              onClick: R,
              disabled: E.isPending,
              children: [
                O.jsx(b_, { className: "mr-2 h-4 w-4" }),
                "Cerrar Sesión",
              ],
            }),
          ],
        }),
      }),
      O.jsxs("div", {
        className: "flex-1 flex overflow-hidden",
        children: [
          O.jsxs("div", {
            className:
              "w-full md:w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden",
            children: [
              O.jsxs("div", {
                className: "p-4 border-b border-slate-200 space-y-3",
                children: [
                  O.jsxs("div", {
                    className: "relative",
                    children: [
                      O.jsx(S_, {
                        className:
                          "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400",
                      }),
                      O.jsx(yd, {
                        placeholder: "Buscar paciente...",
                        value: a,
                        onChange: (j) => i(j.target.value),
                        className: "pl-10 h-9",
                      }),
                    ],
                  }),
                  O.jsxs(QR, {
                    value: o,
                    onValueChange: s,
                    children: [
                      O.jsx(YR, {
                        className: "h-9",
                        children: O.jsx(VR, {
                          placeholder: "Filtrar por tipo de estudio",
                        }),
                      }),
                      O.jsxs(GR, {
                        children: [
                          O.jsx(dg, { value: "", children: "Todos los tipos" }),
                          g.map((j) => O.jsx(dg, { value: j, children: j }, j)),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              O.jsx("div", {
                className: "flex-1 overflow-y-auto",
                children: p
                  ? O.jsx("div", {
                      className: "flex items-center justify-center h-32",
                      children: O.jsx(gb, {
                        className: "h-6 w-6 animate-spin text-slate-400",
                      }),
                    })
                  : C.length === 0
                    ? O.jsx("div", {
                        className: "p-4 text-center text-slate-500",
                        children: O.jsx("p", {
                          className: "text-sm",
                          children: "No se encontraron informes",
                        }),
                      })
                    : O.jsx("div", {
                        className: "divide-y divide-slate-200",
                        children: C.map((j) =>
                          O.jsxs(
                            "button",
                            {
                              onClick: () => d(j.id),
                              className: `w-full text-left p-3 hover:bg-slate-50 transition-colors border-l-4 ${c === j.id ? "border-l-blue-500 bg-blue-50" : "border-l-transparent"}`,
                              children: [
                                O.jsx("p", {
                                  className:
                                    "font-medium text-sm text-slate-900 truncate",
                                  children: j.patientName || "Sin nombre",
                                }),
                                O.jsx("p", {
                                  className: "text-xs text-slate-600 truncate",
                                  children: j.studyType || "Sin tipo",
                                }),
                                O.jsx("p", {
                                  className: "text-xs text-slate-500",
                                  children: j.uploadDate
                                    ? new Date(j.uploadDate).toLocaleDateString(
                                        "es-ES",
                                      )
                                    : "Sin fecha",
                                }),
                              ],
                            },
                            j.id,
                          ),
                        ),
                      }),
              }),
            ],
          }),
          O.jsx("div", {
            className: "flex-1 flex flex-col bg-slate-100 overflow-hidden",
            children: S
              ? O.jsxs(O.Fragment, {
                  children: [
                    O.jsx("div", {
                      className: "bg-white border-b border-slate-200 p-4",
                      children: O.jsxs("div", {
                        className: "flex items-start justify-between",
                        children: [
                          O.jsxs("div", {
                            className: "flex-1",
                            children: [
                              O.jsx("h2", {
                                className:
                                  "text-lg font-semibold text-slate-900",
                                children: S.patientName || "Informe sin nombre",
                              }),
                              O.jsxs("div", {
                                className:
                                  "mt-2 grid grid-cols-2 gap-4 text-sm text-slate-600",
                                children: [
                                  O.jsxs("div", {
                                    children: [
                                      O.jsx("p", {
                                        className: "font-medium text-slate-700",
                                        children: "Tipo de Estudio",
                                      }),
                                      O.jsx("p", {
                                        children:
                                          S.studyType || "No especificado",
                                      }),
                                    ],
                                  }),
                                  O.jsxs("div", {
                                    children: [
                                      O.jsx("p", {
                                        className: "font-medium text-slate-700",
                                        children: "Fecha",
                                      }),
                                      O.jsx("p", {
                                        children: S.uploadDate
                                          ? new Date(
                                              S.uploadDate,
                                            ).toLocaleDateString("es-ES")
                                          : "No especificada",
                                      }),
                                    ],
                                  }),
                                  O.jsxs("div", {
                                    className: "col-span-2",
                                    children: [
                                      O.jsx("p", {
                                        className: "font-medium text-slate-700",
                                        children: "Archivo",
                                      }),
                                      O.jsx("p", {
                                        className: "truncate",
                                        children: S.fileName || "Sin nombre",
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                            ],
                          }),
                          O.jsxs(qs, {
                            onClick: M,
                            disabled: !w?.downloadUrl,
                            size: "sm",
                            className: "ml-4",
                            children: [
                              O.jsx(y_, { className: "mr-2 h-4 w-4" }),
                              "Descargar",
                            ],
                          }),
                        ],
                      }),
                    }),
                    O.jsx("div", {
                      className:
                        "flex-1 overflow-hidden bg-slate-200 flex items-center justify-center",
                      children: S.previewUrl
                        ? O.jsx("iframe", {
                            src: S.previewUrl,
                            className: "w-full h-full border-none",
                            title: "PDF Viewer",
                          })
                        : O.jsxs(qb, {
                            className: "m-4 max-w-md",
                            children: [
                              O.jsx(Gd, { className: "h-4 w-4" }),
                              O.jsx(Pb, {
                                children:
                                  "No se puede visualizar el PDF. Descárgalo para verlo.",
                              }),
                            ],
                          }),
                    }),
                  ],
                })
              : O.jsx("div", {
                  className: "flex-1 flex items-center justify-center",
                  children: O.jsx("div", {
                    className: "text-center",
                    children: O.jsx("p", {
                      className: "text-slate-500 text-lg",
                      children: "Selecciona un informe para visualizarlo",
                    }),
                  }),
                }),
          }),
        ],
      }),
    ],
  });
}
function ZR() {
  return O.jsxs(Y_, {
    children: [
      O.jsx(Rl, { path: "/", component: ug }),
      O.jsx(Rl, { path: "/login", component: ug }),
      O.jsx(Rl, { path: "/reports", component: IR }),
      O.jsx(Rl, { path: "/404", component: Jy }),
      O.jsx(Rl, { component: Jy }),
    ],
  });
}
function FR() {
  return O.jsx(G_, {
    children: O.jsx(X_, {
      defaultTheme: "light",
      children: O.jsxs(JT, { children: [O.jsx(e2, {}), O.jsx(ZR, {})] }),
    }),
  });
}
const $R = () => {
    const i = `${window.location.origin}/api/oauth/callback`,
      o = btoa(i),
      s = new URL("undefined/app-auth");
    return (
      s.searchParams.set("appId", void 0),
      s.searchParams.set("redirectUri", i),
      s.searchParams.set("state", o),
      s.searchParams.set("type", "signIn"),
      s.toString()
    );
  },
  ks = new ew(),
  hx = (n) => {
    !(n instanceof Ll) ||
      typeof window > "u" ||
      !(n.message === HE) ||
      (window.location.href = $R());
  };
ks.getQueryCache().subscribe((n) => {
  if (n.type === "updated" && n.action.type === "error") {
    const a = n.query.state.error;
    (hx(a), console.error("[API Query Error]", a));
  }
});
ks.getMutationCache().subscribe((n) => {
  if (n.type === "updated" && n.action.type === "error") {
    const a = n.mutation.state.error;
    (hx(a), console.error("[API Mutation Error]", a));
  }
});
const JR = rr.createClient({
  links: [
    cE({
      url: "/api/trpc",
      transformer: or,
      fetch(n, a) {
        return globalThis.fetch(n, { ...(a ?? {}), credentials: "include" });
      },
    }),
  ],
});
VE.createRoot(document.getElementById("root")).render(
  O.jsx(rr.Provider, {
    client: JR,
    queryClient: ks,
    children: O.jsx(nw, { client: ks, children: O.jsx(FR, {}) }),
  }),
);
