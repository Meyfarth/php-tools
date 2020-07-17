<?php

class EmptyClass
{
    use TestTrait;
    public const LAST_NAME = 'Michel';

    public function __construct(string $lastName = self::LAST_NAME)
    {

    }
}