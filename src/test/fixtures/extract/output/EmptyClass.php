<?php

class EmptyClass
{
    public const TEST_CONSTANT_EMPTY_CLASS = 'firstname';
    public function __construct(string $firstName = self::TEST_CONSTANT_EMPTY_CLASS)
    {

    }
}