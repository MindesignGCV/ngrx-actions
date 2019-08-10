import { Injectable } from '@angular/core';
import { Store, Selector } from '@ngrx/store';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable()
export class NgrxSelect {
  static store: Store<any> | undefined = undefined;
  connect(store: Store<any>) {
    NgrxSelect.store = store;
  }
}

/**
 * Slice state from the store.
 */
export function Select<TState = any, TValue = any>(
  selectorOrFeatureOrObservableForTakeUntil?: string | Selector<TState, TValue> | Observable<any>,
  observableForTakeUntil?: Observable<any>,
  ...paths: string[]
) {
  return function(target: any, name: string): void {
    let fn: Selector<TState, TValue>;
    // Nothing here? Use properly name as selector
    if (!selectorOrFeatureOrObservableForTakeUntil) {
      selectorOrFeatureOrObservableForTakeUntil = name;
    }
    if (selectorOrFeatureOrObservableForTakeUntil instanceof Observable) {
      observableForTakeUntil = selectorOrFeatureOrObservableForTakeUntil;
      selectorOrFeatureOrObservableForTakeUntil = name;
    }
    // Handle string vs Selector<TState, TValue>
    if (typeof selectorOrFeatureOrObservableForTakeUntil === 'string') {
      const propsArray = paths.length
        ? [selectorOrFeatureOrObservableForTakeUntil, ...paths]
        : selectorOrFeatureOrObservableForTakeUntil.split('.');
      fn = fastPropGetter(propsArray);
    } else {
      fn = selectorOrFeatureOrObservableForTakeUntil;
    }

    const createSelect = () => {
      const store = NgrxSelect.store;
      if (!store) {
        throw new Error('NgrxSelect not connected to store!');
      }
      return store.select(fn);
    };

    if (observableForTakeUntil) {
      createSelect()
        .pipe(takeUntil(observableForTakeUntil))
        .subscribe(value => {
          target[name] = value;
        });
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
