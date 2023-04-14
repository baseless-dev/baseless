# Terminology

## Identity

Refers to the attributes that distinguish an entity and define their uniqueness.
An individual or a service must contain **at most one** [Identity](#identity).

## Identity Identification

Refers to the _identification_ (eg. email, username, phone number) that is
assigned to a single [Identity](#identity). An [Identity](#identity) must have
**at least one** [Identity Identification](#identity-identification).

## Identity Challenge

Refers to a _question_ (eg. ask for password, math problem, OTP by email) that
the end user must _answer_ to unlock the [Identity](#identity). The _answer_ can
be entered manually (eg. password, code) or automatically with an external
process. An [Identity](#identity) can have **zero or more**
[Identity Challenge](#identity-challenge).

## Authentication State

Refers to a server-signed token that represent the state of the authentication
process. It contains the [Identity](#identity) unique ID and the authentication
steps answered thus far.

# Authentication flow

Authentication process involve at **least one**
[Identity Identification](#identity-identification) step and **zero or more**
[Identity Challenge](#identity-challenge) steps.

The [Identity Identification](#identity-identification) step process ask the end
user to provide an identification. The system lookup the [Identity](#identity)
assigned to the identification provided. If the
[Authentication State](#authentication-state) already contained an
[Identity](#identity) ID, they must match. Then the system returns an newly, or
updated, [Authentication State](#authentication-state).

The [Identity Challenge](#identity-challenge) step process ask the end user a
question that needs to be answered. The _ask_ can be either a literal question
or an external process (eg. OTP by email, TOTP, authenticator, backup code). If
the challenge is timed (eg. didn't receive email or SMS), the end user can
choose to retry the challenge. In the advent that the end user has no longer
access to the challenge (eg. forgot password, device lost, backup code
exhausted), it must contact an administrator.

End user need to complete the authentication flow for the server to issue an
session token.

# Security

The [Identity Identification](#identity-identification) and
[Identity Challenge](#identity-challenge) must be rate-limited to prevent
_identification_ scanning, _challenge_ brute force and billing exhaustion (eg.
email usage, SMS usage, push notification usage).
