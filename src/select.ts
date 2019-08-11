import { Injectable } from '@angular/core';
import { Store, Selector } from '@ngrx/store';

@Injectable()
export class NgrxSelect {
  static store: Store<any> | undefined = undefined;
  static selectorNamesProp = Symbol();
  static subscriptionsProp = Symbol();
  static initSubscriptionsFnProp = Symbol();
  connect(store: Store<any>) {
    NgrxSelect.store = store;
  }
}

/**
 * Slice state from the store.
 */
export function Select<TState = any, TValue = any>(
  selectorOrFeature?: string | Selector<TState, TValue>,
  autoSubscribe: boolean = false,
  ...paths: string[]
) {
  return function(target: any, name: string): void {
    let fn: Selector<TState, TValue>;
    // Nothing here? Use properly name as selector
    if (!selectorOrFeature) {
      selectorOrFeature = name;
    }
    // Handle string vs Selector<TState, TValue>
    if (typeof selectorOrFeature === 'string') {
      const propsArray = paths.length ? [selectorOrFeature, ...paths] : selectorOrFeature.split('.');
      fn = fastPropGetter(propsArray);
    } else {
      fn = selectorOrFeature;
    }

    const createSelect = () => {
      const store = NgrxSelect.store;
      if (!store) {
        throw new Error('NgrxSelect not connected to store!');
      }
      return store.select(fn);
    };

    if (autoSubscribe) {
      if (!target[NgrxSelect.selectorNamesProp]) {
        target[NgrxSelect.selectorNamesProp] = [];
      }

      if (!target[NgrxSelect.selectorNamesProp].includes(name)) {
        target[NgrxSelect.selectorNamesProp].push(name);
      }

      if (!target[NgrxSelect.initSubscriptionsFnProp]) {
        target[NgrxSelect.initSubscriptionsFnProp] = () => {
          target[NgrxSelect.subscriptionsProp] = {};

          for (const selectorName of target[NgrxSelect.selectorNamesProp]) {
            target[NgrxSelect.subscriptionsProp] = createSelect().subscribe(value => {
              target[selectorName] = value;
            });
          }
        };
      }

      const ngOnInitFn = target['ngOnInit'];
      const initSubscriptionsFn = () => {
        if (!target[NgrxSelect.subscriptionsProp] && target[NgrxSelect.initSubscriptionsFnProp]) {
          target[NgrxSelect.initSubscriptionsFnProp]();
        }
      };
      if (!ngOnInitFn) {
        target['ngOnInit'] = initSubscriptionsFn;
      } else {
        target['ngOnInit'] = () => {
          initSubscriptionsFn();
          ngOnInitFn();
        };
      }

      const cleanSubscriptionsFn = () => {
        if (target[NgrxSelect.subscriptionsProp]) {
          Object.keys(target[NgrxSelect.subscriptionsProp]).forEach(key => {
            target[NgrxSelect.subscriptionsProp][key].unsubscribe();
          });

          target[NgrxSelect.subscriptionsProp] = null;
        }
      };

      const ngOnDestroyFn = target['ngOnDestroy'];
      if (!ngOnDestroyFn) {
        target['ngOnDestroy'] = cleanSubscriptionsFn;
      } else {
        target['ngOnDestroy'] = () => {
          cleanSubscriptionsFn();
          ngOnDestroyFn();
        };
      }
    } else if (delete target[name]) {
      // Redefine property
      Object.defineProperty(target, name, {
        get: function() {
          // @ts-ignore
          if (typeof __selector__fn_variable__name__ === 'undefined') {
            // tslint:disable-next-line
            var __selector__fn_variable__name__ = createSelect.apply(this);
          }

          // @ts-ignore
          return __selector__fn_variable__name__;
        },
        enumerable: true,
        configurable: true
      });
    }
  };
}

/**
 * The generated function is faster than:
 * - pluck (Observable operator)
 * - memoize (old ngrx-actions implementation)
 * - MemoizedSelector (ngrx)
 */
export function fastPropGetter(paths: string[]): (x: any) => any {
  const segments = paths;
  let seg = 'store.' + segments[0],
    i = 0;
  const l = segments.length;
  let expr = seg;
  while (++i < l) {
    expr = expr + ' && ' + (seg = seg + '.' + segments[i]);
  }
  const fn = new Function('store', 'return ' + expr + ';');
  return <(x: any) => any>fn;
}
