[@ai16z/eliza v0.1.5-alpha.5](../index.md) / GenerationOptions

# Interface: GenerationOptions

Configuration options for generating objects with a model.

## Properties

### runtime

> **runtime**: [`IAgentRuntime`](IAgentRuntime.md)

#### Defined in

[packages/core/src/generation.ts:1071](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1071)

***

### context

> **context**: `string`

#### Defined in

[packages/core/src/generation.ts:1072](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1072)

***

### modelClass

> **modelClass**: [`ModelClass`](../enumerations/ModelClass.md)

#### Defined in

[packages/core/src/generation.ts:1073](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1073)

***

### schema?

> `optional` **schema**: `ZodType`\<`any`, `ZodTypeDef`, `any`\>

#### Defined in

[packages/core/src/generation.ts:1074](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1074)

***

### schemaName?

> `optional` **schemaName**: `string`

#### Defined in

[packages/core/src/generation.ts:1075](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1075)

***

### schemaDescription?

> `optional` **schemaDescription**: `string`

#### Defined in

[packages/core/src/generation.ts:1076](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1076)

***

### stop?

> `optional` **stop**: `string`[]

#### Defined in

[packages/core/src/generation.ts:1077](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1077)

***

### mode?

> `optional` **mode**: `"auto"` \| `"json"` \| `"tool"`

#### Defined in

[packages/core/src/generation.ts:1078](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1078)

***

### experimental\_providerMetadata?

> `optional` **experimental\_providerMetadata**: `Record`\<`string`, `unknown`\>

#### Defined in

[packages/core/src/generation.ts:1079](https://github.com/DamoclesLabs/NyxAgent/blob/main/packages/core/src/generation.ts#L1079)
