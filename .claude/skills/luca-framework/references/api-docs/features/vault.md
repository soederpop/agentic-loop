# Vault (features.vault)

The Vault feature provides encryption and decryption capabilities using AES-256-GCM. This feature allows you to securely encrypt and decrypt sensitive data using industry-standard encryption. It manages secret keys and provides a simple interface for cryptographic operations.

## Usage

```ts
container.feature('vault')
```

## Methods

### secret

Gets or generates a secret key for encryption operations.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ refresh = false, set = true }` | `any` |  | Parameter { refresh = false, set = true } |

**Returns:** `Buffer`



### decrypt

Decrypts an encrypted payload that was created by the encrypt method.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | The encrypted payload to decrypt (base64 encoded with delimiters) |

**Returns:** `void`



### encrypt

Encrypts a plaintext string using AES-256-GCM encryption.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `payload` | `string` | ✓ | The plaintext string to encrypt |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `secretText` | `any` | Gets the secret key as a base64-encoded string. |

## Examples

**features.vault**

```ts
const vault = container.feature('vault')

// Encrypt sensitive data
const encrypted = vault.encrypt('sensitive information')
console.log(encrypted) // Base64 encoded encrypted data

// Decrypt the data
const decrypted = vault.decrypt(encrypted)
console.log(decrypted) // 'sensitive information'
```

