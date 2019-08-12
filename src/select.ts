import { Injectable } from '@angular/core';
import { Store, Selector } from '@ngrx/store';

@Injectable()
export class NgrxSelect {
  static store: Store<any> | undefined = undefined;
  static selectorsProp = Symbol();
  static subscriptionsProp = Symbol();
  static initSubscriptionsFnProp = Symbol();
  static cdrProp = Symbol();
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
      if (!target[NgrxSelect.selectorsProp]) {
        target[NgrxSelect.selectorsProp] = {};
      }

      if (!target[NgrxSelect.selectorsProp][name]) {
        target[NgrxSelect.selectorsProp][name] = createSelect;
      }

      if (!target[NgrxSelect.initSubscriptionsFnProp]) {
        target[NgrxSelect.initSubscriptionsFnProp] = function() {
          this[NgrxSelect.subscriptionsProp] = {};

          for (const selectorName of Object.keys(this[NgrxSelect.selectorsProp])) {
            this[NgrxSelect.subscriptionsProp][selectorName] = this[NgrxSelect.selectorsProp]
              [selectorName]()
              .subscribe(value => {
                this[selectorName] = value;
                if (!this.hasOwnProperty(NgrxSelect.cdrProp)) {
                  throw new Error(
                    `The component "${this.constructor.name}" should have property "this[NgrxSelect.cdrProp]".
                      please add "this[NgrxSelect.cdrProp] = cdr;" in your constructor.
                      (it should be placed before this[NgrxSelect.initSubscriptionProp]()).`
                  );
                }
                this[NgrxSelect.cdrProp].markForCheck();
              });
          }
        };
      }

      const ngOnInitFn = target['ngOnInit'];
      const initSubscriptionsFn = function() {
        // @ts-ignore
        if (!this[NgrxSelect.subscriptionsProp] && this[NgrxSelect.initSubscriptionsFnProp]) {
          // @ts-ignore
          this[NgrxSelect.initSubscriptionsFnProp]();
        }
      };
      if (!ngOnInitFn) {
        target['ngOnInit'] = initSubscriptionsFn;
      } else {
        target['ngOnInit'] = function() {
          ngOnInitFn.bind(this)();
          initSubscriptionsFn.bind(this)();
        };
      }

      const cleanSubscriptionsFn = function() {
        // @ts-ignore
        if (this[NgrxSelect.subscriptionsProp]) {
          // @ts-ignore
          Object.keys(this[NgrxSelect.subscriptionsProp]).forEach(key => {
            // @ts-ignore
            this[NgrxSelect.subscriptionsProp][key].unsubscribe();
          });

          // @ts-ignore
          this[NgrxSelect.subscriptionsProp] = null;
        }
      };

      const ngOnDestroyFn = target['ngOnDestroy'];
      if (!ngOnDestroyFn) {
        target['ngOnDestroy'] = cleanSubscriptionsFn;
      } else {
        target['ngOnDestroy'] = function() {
          cleanSubscriptionsFn.bind(this)();
          ngOnDestroyFn.bind(this)();
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
