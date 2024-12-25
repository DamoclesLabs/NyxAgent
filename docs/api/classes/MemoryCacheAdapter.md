[@ai16z/eliza v0.1.5-alpha.5](../index.md) / MemoryCacheAdapter

# Class: MemoryCacheAdapter

## Implements

- [`ICacheAdapter`](../interfaces/ICacheAdapter.md)

## Constructors

### new MemoryCacheAdapter()

> **new MemoryCacheAdapter**(`initalData`?): [`MemoryCacheAdapter`](MemoryCacheAdapter.md)

#### Parameters

• **initalData?**: `Map`\<`string`, `string`\>

#### Returns

[`MemoryCacheAdapter`](MemoryCacheAdapter.md)

#### Defined in

packages/core/src/cache.ts:19

## Properties

### data

> **data**: `Map`\<`string`, `string`\>

#### Defined in

packages/core/src/cache.ts:17

## Methods

### get()

> **get**(`key`): `Promise`\<`string`\>

#### Parameters

• **key**: `string`

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`ICacheAdapter`](../interfaces/ICacheAdapter.md).[`get`](../interfaces/ICacheAdapter.md#get)

#### Defined in

packages/core/src/cache.ts:23

***

### set()

> **set**(`key`, `value`): `Promise`\<`void`\>

#### Parameters

• **key**: `string`

• **value**: `string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheAdapter`](../interfaces/ICacheAdapter.md).[`set`](../interfaces/ICacheAdapter.md#set)

#### Defined in

packages/core/src/cache.ts:27

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

#### Parameters

• **key**: `string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ICacheAdapter`](../interfaces/ICacheAdapter.md).[`delete`](../interfaces/ICacheAdapter.md#delete)

#### Defined in

packages/core/src/cache.ts:31